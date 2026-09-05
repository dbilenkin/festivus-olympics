import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand,
} from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const TABLE = process.env.TABLE_NAME;

/* ------------------------------------------------------------------ limits */
const MAX_BODY_BYTES = 128 * 1024;
const MAX_FACTS = 200;
const MAX_KEY_LEN = 120;
const MAX_VALUE_JSON = 512;
const MAX_STRING_LEN = 80;
const TS_PAST_MS = 30 * 24 * 60 * 60 * 1000;
const TS_FUTURE_MS = 5000;

// The whole data model. First segment must be one of these.
const KEY_GRAMMAR = /^(event|player|game|teams|round|relay|score)(\.[A-Za-z0-9_-]{1,24})*$/;
const EVENT_ID = /^[a-z0-9][a-z0-9-]{2,39}$/;
const CONTROL_CHARS = new RegExp("[\\u0000-\\u001f\\u007f]");

/* ------------------------------------------------------------------- utils */
// NOTE: no CORS headers here on purpose. The HTTP API emits them; if we did too the
// browser would see duplicates and reject the response.
const json = (statusCode, body) => ({
  statusCode,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
  body: JSON.stringify(body),
});
const bad = (msg, code = 400) => json(code, { error: msg });

function collectStrings(v, out = []) {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => collectStrings(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => collectStrings(x, out));
  return out;
}

/** Writes are wide open, so every incoming value is treated as hostile. */
function validateValue(v) {
  if (v === null) return null;
  const t = typeof v;
  if (t !== "string" && t !== "number" && t !== "boolean" && t !== "object")
    return "unsupported value type";
  if (t === "number" && !Number.isFinite(v)) return "non-finite number";
  const enc = JSON.stringify(v);
  if (enc === undefined || enc.length > MAX_VALUE_JSON) return "value too large";
  // Angle brackets are rejected because names flow into chart SVG markup. This is a
  // security control, not formatting.
  for (const s of collectStrings(v)) {
    if (s.length > MAX_STRING_LEN) return "string too long";
    if (/[<>]/.test(s)) return "angle brackets not allowed";
    if (CONTROL_CHARS.test(s)) return "control characters not allowed";
  }
  return null;
}

/** A phone with a broken (or hostile) clock must not win every conflict forever. */
const clampTs = (ts, now) => {
  const n = Number(ts);
  if (!Number.isFinite(n)) return now;
  return Math.min(Math.max(Math.round(n), now - TS_PAST_MS), now + TS_FUTURE_MS);
};

const slug = (s) =>
  (String(s || "event").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "event")
    .slice(0, 24);
const rand = (n) => {
  const a = "0123456789abcdefghjkmnpqrstvwxyz";
  return Array.from({ length: n }, () => a[Math.floor(Math.random() * a.length)]).join("");
};

/* ------------------------------------------------------------------ storage */
const metaKey = (id) => ({ pk: `EVT#${id}`, sk: "META" });

async function readMeta(id) {
  const r = await ddb.send(new GetCommand({
    TableName: TABLE, Key: metaKey(id),
    ProjectionExpression: "ver, #n, createdAt",
    ExpressionAttributeNames: { "#n": "name" },
  }));
  return r.Item || null;
}

async function readFacts(id) {
  const facts = {};
  let ExclusiveStartKey;
  do {
    const r = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :p)",
      ExpressionAttributeValues: { ":pk": `EVT#${id}`, ":p": "F#" },
      ExclusiveStartKey,
    }));
    for (const it of r.Items || []) facts[it.sk.slice(2)] = { v: it.v, ts: it.ts, by: it.by };
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return facts;
}

/**
 * The merge happens IN DynamoDB via a conditional put, never as read-modify-write in the
 * handler (which would race two concurrent invocations). A ConditionalCheckFailed means
 * "someone newer already won" -- that is success, not an error.
 */
async function putFact(id, k, v, ts, by) {
  try {
    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: { pk: `EVT#${id}`, sk: `F#${k}`, v, ts, by },
      ConditionExpression:
        "attribute_not_exists(sk) OR #ts < :ts OR (#ts = :ts AND #by < :by)",
      ExpressionAttributeNames: { "#ts": "ts", "#by": "by" },
      ExpressionAttributeValues: { ":ts": ts, ":by": by },
    }));
    return { k, applied: true };
  } catch (e) {
    if (e.name === "ConditionalCheckFailedException") return { k, applied: false };
    throw e;
  }
}

const bumpVersion = (id) =>
  ddb.send(new UpdateCommand({
    TableName: TABLE, Key: metaKey(id),
    UpdateExpression: "ADD ver :one SET lastWriteAt = :now",
    ExpressionAttributeValues: { ":one": 1, ":now": Date.now() },
    ReturnValues: "UPDATED_NEW",
  }));

function parseBody(event) {
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64").toString("utf8")
    : event.body || "";
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) return "body too large";
  try {
    const o = JSON.parse(raw || "{}");
    return o && typeof o === "object" && !Array.isArray(o) ? o : "body must be an object";
  } catch {
    return "invalid JSON";
  }
}

/* ------------------------------------------------------------------ handler */
export const handler = async (event) => {
  const now = Date.now();
  const method = event.requestContext?.http?.method || "GET";
  const path = (event.rawPath || "/").replace(/\/+$/, "") || "/";
  const seg = path.split("/").filter(Boolean);

  try {
    if (method === "GET" && path === "/health") return json(200, { ok: true, serverNow: now });

    if (method === "POST" && path === "/events") {
      const body = parseBody(event);
      if (typeof body === "string") return bad(body);
      const name = String(body.name || "Pond Neck Olympics").slice(0, MAX_STRING_LEN);
      if (/[<>]/.test(name)) return bad("angle brackets not allowed");
      // Unguessable by design: the API URL ships in a public bundle, so the event id is
      // what actually keeps a stranger from finding your day.
      const eventId = `${slug(name)}-${rand(6)}`;
      await ddb.send(new PutCommand({
        TableName: TABLE,
        Item: { ...metaKey(eventId), ver: 1, name, createdAt: now },
        ConditionExpression: "attribute_not_exists(pk)",
      }));
      return json(201, { eventId, ver: 1, name, serverNow: now });
    }

    if (method === "GET" && seg[0] === "events" && seg.length === 2) {
      const id = seg[1];
      if (!EVENT_ID.test(id)) return bad("bad event id");
      const meta = await readMeta(id);
      if (!meta) return bad("no such event", 404);
      const since = Number(event.queryStringParameters?.since);
      if (Number.isFinite(since) && since === meta.ver)
        return json(200, { ver: meta.ver, serverNow: now, unchanged: true });
      return json(200, {
        eventId: id, name: meta.name, ver: meta.ver, serverNow: now,
        facts: await readFacts(id),
      });
    }

    if (method === "POST" && seg[0] === "events" && seg[2] === "facts" && seg.length === 3) {
      const id = seg[1];
      if (!EVENT_ID.test(id)) return bad("bad event id");
      const body = parseBody(event);
      if (typeof body === "string") return bad(body);

      const by = String(body.by || "");
      if (!/^[A-Za-z0-9_-]{3,32}$/.test(by)) return bad("bad client id");
      const facts = body.facts;
      if (!Array.isArray(facts) || facts.length === 0) return bad("no facts");
      if (facts.length > MAX_FACTS) return bad(`too many facts (max ${MAX_FACTS})`);

      const meta = await readMeta(id);
      if (!meta) return bad("no such event", 404);

      const prepared = [];
      for (const f of facts) {
        const k = String(f?.k || "");
        if (k.length > MAX_KEY_LEN || !KEY_GRAMMAR.test(k))
          return bad(`bad fact key: ${k.slice(0, 40)}`);
        const err = validateValue(f.v);
        if (err) return bad(`${k}: ${err}`);
        prepared.push({ k, v: f.v ?? null, ts: clampTs(f.ts, now) });
      }

      // Parallel conditional puts, NOT a transaction: one already-superseded leg must not
      // discard the other four splits of a saved run.
      const results = await Promise.all(prepared.map((f) => putFact(id, f.k, f.v, f.ts, by)));
      const rejectedKeys = results.filter((r) => !r.applied).map((r) => r.k);
      const applied = results.length - rejectedKeys.length;

      let ver = meta.ver;
      if (applied > 0) {
        const up = await bumpVersion(id);
        ver = up.Attributes?.ver ?? ver + 1;
      }

      // Hand back the winning value for anything rejected, so the loser reconciles
      // immediately instead of waiting for the next poll.
      let conflicts = [];
      if (rejectedKeys.length) {
        const all = await readFacts(id);
        conflicts = rejectedKeys.map((k) => ({ k, ...(all[k] || {}) }));
      }
      return json(200, { ver, serverNow: now, applied, rejected: rejectedKeys.length, conflicts });
    }

    return bad("not found", 404);
  } catch (err) {
    console.error("unhandled", { path, method, message: err?.message, name: err?.name });
    return json(500, { error: "internal error" });
  }
};
