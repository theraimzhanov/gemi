import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateTryOn, totalUsd, type Img } from "@/lib/gemini";
import { saveLook } from "@/lib/looks";
import { bad, fail, isImg } from "@/lib/validate";

export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const b = await req.json().catch(() => null);
  if (!Number.isInteger(id)) return bad("Unknown look", 404);
  if (!isImg(b?.selfie)) return bad("Add a photo of yourself first.");
  try {
    const user = await currentUser();
    if (!user) return bad("Log in to try looks on.", 401);
    const look = await db.query("SELECT garments FROM looks WHERE id = $1 AND (shared OR user_id = $2)", [id, user.id]);
    if (!look.rowCount) return bad("Unknown look", 404);
    const garments = look.rows[0].garments;
    const refRows = await db.query("SELECT image, mime FROM garment_refs WHERE look_id = $1 ORDER BY id", [id]);
    const refs: Img[] = refRows.rows.map((r) => ({ mime: r.mime, data: r.image.toString("base64") }));
    const image = await generateTryOn(b.selfie, garments, refs);
    const newId = await saveLook(user, image, garments, refs);
    await db.query("INSERT INTO look_events (look_id, kind, user_id) VALUES ($1, 'tryon', $2)", [id, user.id]);
    return Response.json({ intent: { tool: "try_on" }, id: newId, image, garments, refs, total_usd: totalUsd(garments) });
  } catch (e) {
    return fail(e);
  }
}
