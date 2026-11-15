// Run:  node --env-file=.env.local scripts/seed.ts
// Replaces the demo looks in the community feed with the ones in lib/demo.ts and their photos in public/looks.
// Only looks owned by the demo accounts are touched; real users' looks are left alone.
import { existsSync, readFileSync } from "node:fs";
import { lookArt } from "../lib/art.ts";
import { db, toVector } from "../lib/db.ts";
import { DEMO } from "../lib/demo.ts";
import { describe, embed, totalUsd } from "../lib/gemini.ts";

// Demo accounts own the seeded looks; "!" is not a valid hash, so nobody can log in as them.
const authors = [...new Set(DEMO.map((l) => l.author))];
for (const a of authors) await db.query("INSERT INTO users (username, password_hash) VALUES ($1, '!') ON CONFLICT DO NOTHING", [a]);
const demoUsers = (await db.query("SELECT id, username FROM users WHERE password_hash = '!'")).rows;
const ids = demoUsers.map((r) => r.id);
const users = new Map(demoUsers.map((r) => [r.username, r.id]));

await db.query("DELETE FROM look_events WHERE look_id IN (SELECT id FROM looks WHERE user_id = ANY($1))", [ids]);
await db.query("DELETE FROM looks WHERE user_id = ANY($1)", [ids]);

let photos = 0, embedded = 0;
for (const [i, look] of DEMO.entries()) {
  const file = `public/looks/${String(i).padStart(2, "0")}.jpg`;
  // Falls back to the code-drawn illustration when a look has no photo yet.
  const [image, mime] = existsSync(file) ? [readFileSync(file), "image/jpeg"] : [Buffer.from(lookArt(look.garments, i, look.height)), "image/svg+xml"];
  if (mime === "image/jpeg") photos++;
  // Embeddings power "find similar"; if the embedding service is unavailable the look is still seeded without one.
  const embedding = process.env.GEMINI_API_KEY ? await embed(describe(look.garments)).then(toVector, () => null) : null;
  if (embedding) embedded++;
  const { rows } = await db.query(
    `INSERT INTO looks (author, user_id, shared, image, image_mime, garments, total_usd, embedding, created_at)
     VALUES ($1, $2, true, $3, $4, $5, $6, $7::vector, now() - random() * interval '3 days') RETURNING id`,
    [look.author, users.get(look.author), image, mime, JSON.stringify(look.garments), totalUsd(look.garments), embedding],
  );
  // The photo doubles as the garment reference, which is what "Try on me" copies the outfit from.
  if (mime === "image/jpeg") await db.query("INSERT INTO garment_refs (look_id, image, mime) VALUES ($1, $2, $3)", [rows[0].id, image, mime]);
  for (const u of ids.filter(() => Math.random() < 0.6))
    await db.query("INSERT INTO look_events (time, look_id, kind, user_id) VALUES (now() - random() * interval '20 hours', $1, 'like', $2)", [rows[0].id, u]);
  for (let n = Math.floor(Math.random() * 5); n > 0; n--)
    await db.query("INSERT INTO look_events (time, look_id, kind) VALUES (now() - random() * interval '20 hours', $1, 'tryon')", [rows[0].id]);
}
console.log(`done: ${DEMO.length} demo looks in the feed (${photos} with photos, ${embedded} with embeddings)`);
await db.end();
