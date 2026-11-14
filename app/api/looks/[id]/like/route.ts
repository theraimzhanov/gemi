import { db } from "@/lib/db";
import { bad, fail } from "@/lib/validate";

// shortcut: no accounts, so one person can like many times; dedupe per user once login exists.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return bad("Unknown look", 404);
  try {
    const r = await db.query(
      "INSERT INTO look_events (look_id, kind) SELECT id, 'like' FROM looks WHERE id = $1",
      [id],
    );
    return r.rowCount ? Response.json({ ok: true }) : bad("Unknown look", 404);
  } catch (e) {
    return fail(e);
  }
}
