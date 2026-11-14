import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { bad, fail } from "@/lib/validate";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return bad("Unknown look", 404);
  try {
    const user = await currentUser();
    if (!user) return bad("Log in to like looks.", 401);
    const look = await db.query("SELECT 1 FROM looks WHERE id = $1", [id]);
    if (!look.rowCount) return bad("Unknown look", 404);
    // One like per person per look.
    const r = await db.query(
      `INSERT INTO look_events (look_id, kind, user_id)
       SELECT $1, 'like', $2
       WHERE NOT EXISTS (SELECT 1 FROM look_events WHERE look_id = $1 AND kind = 'like' AND user_id = $2)`,
      [id, user.id],
    );
    return Response.json({ liked: !!r.rowCount });
  } catch (e) {
    return fail(e);
  }
}
