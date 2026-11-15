import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { bad, fail } from "@/lib/validate";

// The page asks this every couple of seconds until its job is done or failed.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return bad("Unknown job", 404);
  try {
    const user = await currentUser();
    if (!user) return bad("Log in again to continue.", 401);
    const { rows } = await db.query(
      "SELECT status, result, error, created_at < now() - interval '5 minutes' AS stale FROM jobs WHERE id = $1 AND user_id = $2",
      [id, user.id],
    );
    const job = rows[0];
    if (!job) return bad("Unknown job", 404);
    if (job.status === "failed") return Response.json({ status: "failed", error: job.error });
    if (job.status === "working")
      // A job still 'working' after five minutes was interrupted, for example by a server restart.
      return Response.json(job.stale ? { status: "failed", error: "That took too long and was stopped. Try again." } : { status: "working" });

    const { intent, look_id, similar } = job.result;
    if (!look_id) return Response.json({ status: "done", reply: { intent, similar } });
    const look = await db.query("SELECT image, image_mime, garments, total_usd, shared FROM looks WHERE id = $1 AND user_id = $2", [look_id, user.id]);
    if (!look.rowCount) return bad("That look no longer exists.", 404);
    const refs = await db.query("SELECT image, mime FROM garment_refs WHERE look_id = $1 ORDER BY id", [look_id]);
    const l = look.rows[0];
    return Response.json({
      status: "done",
      reply: {
        intent, id: look_id, shared: l.shared, garments: l.garments, total_usd: Number(l.total_usd),
        image: { mime: l.image_mime, data: l.image.toString("base64") },
        refs: refs.rows.map((r) => ({ mime: r.mime, data: r.image.toString("base64") })),
      },
    });
  } catch (e) {
    return fail(e);
  }
}
