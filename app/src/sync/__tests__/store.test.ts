import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useStore, putFact } from "../store";
import { K } from "../facts";

/** The API is stubbed so offline behaviour can be forced deterministically. */
const api = vi.hoisted(() => ({ fetchEvent: vi.fn(), pushFacts: vi.fn() }));
vi.mock("../client", async (orig) => {
  const real = await orig<typeof import("../client")>();
  return { ...real, fetchEvent: api.fetchEvent, pushFacts: api.pushFacts };
});

const snapshot = (facts = {}, ver = 1) => ({
  eventId: "e1", name: "Test", ver, serverNow: Date.now(), facts,
});

beforeEach(() => {
  localStorage.clear();
  api.fetchEvent.mockReset();
  api.pushFacts.mockReset();
  useStore.setState({
    eventId: null, name: "", ver: 0, server: {}, outbox: [],
    online: true, syncing: false, conflicts: [],
  });
});
afterEach(() => vi.restoreAllMocks());

describe("writing while offline", () => {
  it("queues the write, keeps showing it, and sends it when the network returns", async () => {
    api.fetchEvent.mockResolvedValue(snapshot());
    useStore.getState().open("e1");
    await vi.waitFor(() => expect(api.fetchEvent).toHaveBeenCalled());

    api.pushFacts.mockRejectedValueOnce(new Error("offline"));
    putFact(K.playerName("p1"), "Andy");
    await vi.waitFor(() => expect(useStore.getState().syncing).toBe(false));

    // the edit is still queued AND still visible
    expect(useStore.getState().outbox).toHaveLength(1);
    expect(useStore.getState().online).toBe(false);
    expect(useStore.getState().view.players[0]?.name).toBe("Andy");

    // ...and survives a reload, because the outbox is persisted
    expect(JSON.parse(localStorage.getItem("pondneck.outbox.e1")!)).toHaveLength(1);

    api.pushFacts.mockResolvedValueOnce({ ver: 2, serverNow: Date.now(), applied: 1, rejected: 0, conflicts: [] });
    api.fetchEvent.mockResolvedValue(snapshot({ [K.playerName("p1")]: { v: "Andy", ts: 1, by: "d1" } }, 2));
    await useStore.getState().flush();

    expect(useStore.getState().outbox).toHaveLength(0);
    expect(useStore.getState().view.players[0]?.name).toBe("Andy");
  });

  it("collapses repeated edits to one key instead of one request per keystroke", async () => {
    api.fetchEvent.mockResolvedValue(snapshot());
    api.pushFacts.mockRejectedValue(new Error("offline"));
    useStore.getState().open("e1");
    await vi.waitFor(() => expect(api.fetchEvent).toHaveBeenCalled());

    for (const n of ["P", "Pe", "Pet", "Pete"]) putFact(K.playerName("p8"), n);
    await vi.waitFor(() => expect(useStore.getState().syncing).toBe(false));

    expect(useStore.getState().outbox).toHaveLength(1);
    expect(useStore.getState().outbox[0].v).toBe("Pete");
  });
});

describe("the lens", () => {
  it("a poll does not revert an unsent local edit", async () => {
    api.fetchEvent.mockResolvedValue(snapshot());
    api.pushFacts.mockRejectedValue(new Error("offline"));
    useStore.getState().open("e1");
    await vi.waitFor(() => expect(api.fetchEvent).toHaveBeenCalled());

    putFact(K.playerName("p1"), "Andrew");
    await vi.waitFor(() => expect(useStore.getState().outbox).toHaveLength(1));

    // server still has the OLD value, and a poll brings it down
    api.fetchEvent.mockResolvedValue(
      snapshot({ [K.playerName("p1")]: { v: "Andy", ts: 1, by: "other" } }, 5),
    );
    await useStore.getState().poll(true);

    expect(useStore.getState().view.players[0]?.name, "my unsent edit got reverted").toBe("Andrew");
  });

  it("but a genuinely newer value from someone else does win", async () => {
    api.fetchEvent.mockResolvedValue(snapshot());
    api.pushFacts.mockRejectedValue(new Error("offline"));
    useStore.getState().open("e1");
    await vi.waitFor(() => expect(api.fetchEvent).toHaveBeenCalled());

    putFact(K.playerName("p1"), "Andrew");
    await vi.waitFor(() => expect(useStore.getState().outbox).toHaveLength(1));

    api.fetchEvent.mockResolvedValue(
      snapshot({ [K.playerName("p1")]: { v: "Andy", ts: Date.now() + 60_000, by: "other" } }, 6),
    );
    await useStore.getState().poll(true);
    expect(useStore.getState().view.players[0]?.name).toBe("Andy");
  });
});

describe("writes made during an in-flight sync", () => {
  it("are not wiped by the response that raced them", async () => {
    api.fetchEvent.mockResolvedValue(snapshot());
    useStore.getState().open("e1");
    await vi.waitFor(() => expect(api.fetchEvent).toHaveBeenCalled());

    // hold the request open, and type again while it is in flight
    let release!: () => void;
    api.pushFacts.mockImplementationOnce(
      () => new Promise((res) => {
        release = () => res({ ver: 2, serverNow: Date.now(), applied: 1, rejected: 0, conflicts: [] });
      }),
    );
    putFact(K.score("r1", "p1", "g1"), 10);
    await vi.waitFor(() => expect(useStore.getState().syncing).toBe(true));

    putFact(K.score("r1", "p1", "g2"), 20);      // arrives mid-flight
    api.pushFacts.mockResolvedValue({ ver: 3, serverNow: Date.now(), applied: 1, rejected: 0, conflicts: [] });
    release();

    await vi.waitFor(() => expect(useStore.getState().syncing).toBe(false));
    // the second write must still exist -- either already sent, or still queued
    const sentSecond = api.pushFacts.mock.calls
      .flatMap((c) => c[1] as { k: string }[])
      .some((f) => f.k === K.score("r1", "p1", "g2"));
    const stillQueued = useStore.getState().outbox.some((f) => f.k === K.score("r1", "p1", "g2"));
    expect(sentSecond || stillQueued, "mid-flight write was dropped").toBe(true);
  });
});

describe("conflicts", () => {
  it("a rejected write is surfaced with both values, not silently swapped", async () => {
    api.fetchEvent.mockResolvedValue(snapshot());
    useStore.getState().open("e1");
    await vi.waitFor(() => expect(api.fetchEvent).toHaveBeenCalled());

    api.pushFacts.mockResolvedValueOnce({
      ver: 9, serverNow: Date.now(), applied: 0, rejected: 1,
      conflicts: [{ k: K.score("r1", "p1", "g1"), v: 38.9, ts: 999, by: "otherphone" }],
    });
    putFact(K.score("r1", "p1", "g1"), 41.2);
    await vi.waitFor(() => expect(useStore.getState().conflicts).toHaveLength(1));

    const c = useStore.getState().conflicts[0];
    expect(c.mine).toBe(41.2);
    expect(c.theirs).toBe(38.9);
  });
});

describe("cold start", () => {
  it("boots from cache when the network is unavailable", async () => {
    localStorage.setItem("pondneck.cache.e1", JSON.stringify({
      [K.playerName("p1")]: { v: "Sachin", ts: 1, by: "d1" },
      [K.gameName("g1")]: { v: "Football", ts: 1, by: "d1" },
    }));
    api.fetchEvent.mockRejectedValue(new Error("offline"));
    useStore.getState().open("e1");

    expect(useStore.getState().view.players[0]?.name).toBe("Sachin");
    await vi.waitFor(() => expect(useStore.getState().online).toBe(false));
    expect(useStore.getState().view.games[0]?.name).toBe("Football");
  });
});
