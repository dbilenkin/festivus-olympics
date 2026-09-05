import { describe, it, expect } from "vitest";
import { extractEventId } from "../Landing";

/** Whatever someone manages to paste from a text message must resolve to the same id. */
describe("opening an event from a pasted link", () => {
  const id = "pond-neck-2026-ab12cd";

  it("takes a full share link", () => {
    expect(extractEventId(`https://dbilenkin.github.io/festivus-olympics/#/e/${id}/pent`)).toBe(id);
  });
  it("takes a link with no panel on the end", () => {
    expect(extractEventId(`https://dbilenkin.github.io/festivus-olympics/#/e/${id}`)).toBe(id);
  });
  it("takes a bare event id", () => {
    expect(extractEventId(id)).toBe(id);
  });
  it("survives the whitespace a paste usually brings", () => {
    expect(extractEventId(`  ${id}\n`)).toBe(id);
  });
  it("normalises case, since ids are lower case", () => {
    expect(extractEventId(id.toUpperCase())).toBe(id);
  });
  it("rejects junk rather than opening an empty event", () => {
    for (const bad of ["", "   ", "hi", "https://example.com", "not a link at all"]) {
      expect(extractEventId(bad)).toBeNull();
    }
  });
});
