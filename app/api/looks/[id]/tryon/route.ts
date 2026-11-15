import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateTryOn, type Img } from "@/lib/gemini";
import { startJob } from "@/lib/jobs";
import { saveLook } from "@/lib/looks";
import { bad, fail, isImg } from "@/lib/validate";

export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const b = await req.json().catch(() => null);
  if (!Number.isInteger(id)) return bad("Unknown look", 404);
  if (!isImg(b?.selfie)) return bad("Add a photo of yourself first.");
  const selfie: Img = b.selfie;
  try {
    const user = await currentUser();
    if (!user) return bad("Log in to try looks on.", 401);
    const look = await db.query("SELECT garments FROM looks WHERE id = $1 AND (shared OR user_id = $2)", [id, user.id]);
    if (!look.rowCount) return bad("Unknown look", 404);
    const garments = look.rows[0].garments;

    return await startJob(user, async () => {
      const refRows = await db.query("SELECT image, mime FROM garment_refs WHERE look_id = $1 ORDER BY id", [id]);
      const refs: Img[] = refRows.rows.map((r) => ({ mime: r.mime, data: r.image.toString("base64") }));
      const look_id = await saveLook(user, await generateTryOn(selfie, garments, refs), garments, refs);
      await db.query("INSERT INTO look_events (look_id, kind, user_id) VALUES ($1, 'tryon', $2)", [id, user.id]);
      return { intent: { tool: "try_on" }, look_id };
    });
  } catch (e) {
    return fail(e);
  }
}
