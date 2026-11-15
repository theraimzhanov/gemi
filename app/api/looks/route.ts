import { currentUser } from "@/lib/auth";
import { db, toVector } from "@/lib/db";
import { describe, embed } from "@/lib/gemini";
import { bad, fail } from "@/lib/validate";

// ?mine=1 lists the caller's own looks; otherwise the shared community feed (?sort=new for newest first).
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const mine = q.get("mine") === "1";
  try {
    const user = await currentUser();
    if (!user) return bad("Log in to see looks.", 401);
    const { rows } = await db.query(
      `WITH taste AS (
         SELECT avg(embedding) AS embedding FROM looks liked
         WHERE liked.shared AND liked.embedding IS NOT NULL AND EXISTS (
           SELECT 1 FROM look_events le WHERE le.look_id = liked.id AND le.user_id = $1 AND le.kind = 'like'
         )
       )
       SELECT l.id, l.author, l.garments, l.total_usd, l.created_at, l.shared,
              count(*) FILTER (WHERE e.kind = 'like')::int  AS likes,
              count(*) FILTER (WHERE e.kind = 'tryon')::int AS tryons,
              count(*) FILTER (WHERE e.time > now() - interval '24 hours')::int AS hot,
              coalesce(bool_or(e.kind = 'like' AND e.user_id = $1), false) AS liked
       FROM looks l LEFT JOIN look_events e ON e.look_id = l.id
       WHERE ${mine ? "l.user_id = $1" : "l.shared"}
       GROUP BY l.id
       ORDER BY ${mine || q.get("sort") === "new" ? "l.created_at DESC" : q.get("sort") === "for-you" ? "l.embedding <=> (SELECT embedding FROM taste) ASC NULLS LAST, hot DESC, l.created_at DESC" : "hot DESC, l.created_at DESC"}
       LIMIT 80`,
      [user.id],
    );
    return Response.json(rows);
  } catch (e) {
    return fail(e);
  }
}

// Shares one of the caller's own looks to the community feed.
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const id = Number(b?.id);
  if (!Number.isInteger(id)) return bad("Nothing to share yet.");
  try {
    const user = await currentUser();
    if (!user) return bad("Log in to share looks.", 401);
    const look = await db.query("SELECT garments FROM looks WHERE id = $1 AND user_id = $2", [id, user.id]);
    if (!look.rowCount) return bad("Unknown look", 404);
    // Sharing must not fail just because the embedding service is busy; the look is then left out of similar-look search.
    const embedding = await embed(describe(look.rows[0].garments)).then(toVector, () => null);
    await db.query("UPDATE looks SET shared = true, embedding = coalesce($2::vector, embedding) WHERE id = $1", [id, embedding]);
    return Response.json({ id, shared: true });
  } catch (e) {
    return fail(e);
  }
}
