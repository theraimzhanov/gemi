// Run against a local dev server. Fixtures are isolated accounts and removed even on failure.
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { db } from "../lib/db.ts";
import { reserveJob } from "../lib/job-limit.ts";
import { RateLimitError } from "../lib/validate.ts";

const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
assert.ok(new URL(base).hostname === "localhost", "Use a local dev server");
const ids: string[] = [];
const token = randomBytes(32).toString("hex");
const cookie = `gemi_session=${token}`;
const call = (path: string, body?: unknown, authenticated = true) => fetch(base + path, {
  method: body === undefined ? "GET" : "POST",
  headers: { ...(authenticated ? { cookie } : {}), "content-type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
try {
  for (let i = 0; i < 2; i++) {
    const { rows } = await db.query("INSERT INTO users (username, password_hash) VALUES ($1, 'unusable-test-password') RETURNING id", [`check_${randomBytes(6).toString("hex")}`]);
    ids.push(rows[0].id);
  }
  await db.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '1 hour')", [createHash("sha256").update(token).digest("hex"), ids[0]]);
  assert.equal((await call("/api/profile", { gender: "", size: "", style: "" }, false)).status, 401);
  assert.equal((await call("/api/profile", { gender: "unisex", size: "M", style: "minimal" })).status, 200);
  const profile = await db.query("SELECT preferences FROM users WHERE id = $1", [ids[0]]);
  assert.equal(profile.rows[0].preferences.size, "M");
  assert.equal((await call("/api/profile", { gender: "", size: "", style: "x".repeat(201) })).status, 400);
  assert.equal((await call("/api/looks?sort=for-you")).status, 200);
  const sample = await db.query("SELECT id FROM looks WHERE shared AND embedding IS NOT NULL LIMIT 1");
  if (sample.rows[0]) {
    const lookId = Number(sample.rows[0].id);
    assert.equal((await call(`/api/looks/${lookId}/like`, {})).status, 200);
    const feed = await (await call("/api/looks?sort=for-you")).json();
    assert.ok(feed.some((l: { id: number; liked: boolean }) => Number(l.id) === lookId && l.liked));
    assert.equal(Number(feed[0].id), lookId, "a liked embedding must affect the For you order");
  }
  assert.equal((await call("/api/chat", { outfits: Array(14).fill({ mime: "image/jpeg", data: "YWJj" }) })).status, 400);
  assert.equal((await call("/api/chat", { text: "test", currentId: -1 })).status, 400);
  const shopping = { request: "top", budget: 10, categories: ["top"], candidates: [{ garment: { category: "top", description: "tee", color: "red", price_usd: 20, price_is_estimate: false, url: "https://store.invalid/tee" } }] };
  const own = await db.query("INSERT INTO jobs (user_id, status, result) VALUES ($1, 'done', $2) RETURNING id", [ids[0], JSON.stringify({ shopping })]);
  const other = await db.query("INSERT INTO jobs (user_id, status, result) VALUES ($1, 'done', $2) RETURNING id", [ids[1], JSON.stringify({ shopping })]);
  assert.equal((await call("/api/chat", { selection: { job: Number(own.rows[0].id), indices: [0] } })).status, 400);
  assert.equal((await call("/api/chat", { selection: { job: Number(other.rows[0].id), indices: [0] } })).status, 400);
  assert.equal((await call(`/api/jobs/${other.rows[0].id}`)).status, 404);
  assert.equal((await call("/api/chat", { selection: { job: Number(own.rows[0].id), indices: [999] } })).status, 400);
  process.env.DAILY_JOB_LIMIT = "3";
  const reservations = await Promise.allSettled(Array.from({ length: 6 }, () => reserveJob(ids[0])));
  assert.equal(reservations.filter((r) => r.status === "fulfilled").length, 2, "one existing search + two reservations exhaust cap");
  assert.ok(reservations.filter((r) => r.status === "rejected").every((r) => r.status === "rejected" && r.reason instanceof RateLimitError));
  await db.query("UPDATE jobs SET created_at = now() - interval '25 hours' WHERE user_id = $1", [ids[0]]);
  assert.ok(await reserveJob(ids[0]));
  console.log("ok persisted preferences, personalized feed, upload validation, owned choices, budget rejection, private jobs, concurrent cap and rolling expiry");
} finally {
  if (ids.length) {
    await db.query("DELETE FROM look_events WHERE user_id = ANY($1::bigint[])", [ids]);
    await db.query("DELETE FROM users WHERE id = ANY($1::bigint[])", [ids]);
  }
  await db.end();
}
