import { db } from "@/lib/db";
import { generateTryOn, totalUsd, type Img } from "@/lib/gemini";
import { bad, fail, isImg } from "@/lib/validate";

export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const b = await req.json().catch(() => null);
  if (!Number.isInteger(id)) return bad("Unknown look", 404);
  if (!isImg(b?.selfie)) return bad("Upload a photo of yourself first.");
  try {
    const look = await db.query("SELECT garments FROM looks WHERE id = $1", [id]);
    if (!look.rowCount) return bad("Unknown look", 404);
    const garments = look.rows[0].garments;
    const refRows = await db.query("SELECT image, mime FROM garment_refs WHERE look_id = $1 ORDER BY id", [id]);
    const refs: Img[] = refRows.rows.map((r) => ({ mime: r.mime, data: r.image.toString("base64") }));
    const image = await generateTryOn(b.selfie, garments, refs);
    await db.query("INSERT INTO look_events (look_id, kind) VALUES ($1, 'tryon')", [id]);
    return Response.json({ intent: { tool: "try_on" }, image, garments, refs, total_usd: totalUsd(garments) });
  } catch (e) {
    return fail(e);
  }
}
