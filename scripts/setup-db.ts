// Run:  node --env-file=.env.local scripts/setup-db.ts
// Creates the tables (safe to re-run) and checks that the hypertable and vector search work.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
assert.ok(process.env.DATABASE_URL, "DATABASE_URL is empty in .env.local");
const { db } = await import("../lib/db.ts");
await db.query(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));

const ext = await db.query("SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector','timescaledb') ORDER BY 1");
console.log("extensions:", ext.rows.map((r) => `${r.extname} ${r.extversion}`).join(", "));
assert.equal(ext.rowCount, 2, "vector and timescaledb must both be installed");

const hyper = await db.query("SELECT 1 FROM timescaledb_information.hypertables WHERE hypertable_name = 'look_events'");
assert.equal(hyper.rowCount, 1, "look_events is not a hypertable");

const v = `[${Array(768).fill(0.1).join(",")}]`;
const dist = await db.query("SELECT $1::vector <=> $1::vector AS d", [v]);
assert.ok(Number(dist.rows[0].d) < 1e-6, "vector distance check failed");

const counts = await db.query("SELECT (SELECT count(*) FROM looks)::int AS looks, (SELECT count(*) FROM look_events)::int AS events");
console.log("ok  tables ready:", counts.rows[0]);
await db.end();
