// Run:  node --env-file=.env.local scripts/seed.ts
// Fills the community feed with the demo looks, drawn as illustrations (no image model needed). Safe to re-run.
import { lookArt } from "../lib/art.ts";
import { db, toVector } from "../lib/db.ts";
import { DEMO } from "../lib/demo.ts";
import { describe, embed, totalUsd } from "../lib/gemini.ts";

// Demo accounts own the seeded looks; "!" is not a valid hash, so nobody can log in as them.
const authors = [...new Set(DEMO.map((l) => l.author))];
for (const a of authors) await db.query("INSERT INTO users (username, password_hash) VALUES ($1, '!') ON CONFLICT DO NOTHING", [a]);
const users = new Map((await db.query("SELECT id, username FROM users WHERE username = ANY($1)", [authors])).rows.map((r) => [r.username, r.id]));

let added = 0, embedded = 0;
for (const [i, look] of DEMO.entries()) {
  const garments = JSON.stringify(look.garments);
  if ((await db.query("SELECT 1 FROM looks WHERE author = $1 AND garments = $2::jsonb", [look.author, garments])).rowCount) continue;
  // Embeddings power "find similar"; if the embedding service is unavailable the look is still seeded without one.
  const embedding = process.env.GEMINI_API_KEY ? await embed(describe(look.garments)).then(toVector, () => null) : null;
  if (embedding) embedded++;
  const { rows } = await db.query(
    `INSERT INTO looks (author, user_id, shared, image, image_mime, garments, total_usd, embedding, created_at)
     VALUES ($1, $2, true, $3, 'image/svg+xml', $4, $5, $6::vector, now() - random() * interval '3 days') RETURNING id`,
    [look.author, users.get(look.author), Buffer.from(lookArt(look.garments, i, look.height)), garments, totalUsd(look.garments), embedding],
  );
  for (const u of [...users.values()].filter(() => Math.random() < 0.6))
    await db.query("INSERT INTO look_events (time, look_id, kind, user_id) VALUES (now() - random() * interval '20 hours', $1, 'like', $2)", [rows[0].id, u]);
  for (let n = Math.floor(Math.random() * 5); n > 0; n--)
    await db.query("INSERT INTO look_events (time, look_id, kind) VALUES (now() - random() * interval '20 hours', $1, 'tryon')", [rows[0].id]);
  added++;
}
const total = (await db.query("SELECT count(*)::int AS n FROM looks WHERE shared")).rows[0].n;
console.log(`done: ${added} look(s) added (${embedded} with embeddings), ${total} shared look(s) in the feed`);
await db.end();
