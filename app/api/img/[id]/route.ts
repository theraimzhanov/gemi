import { db } from "@/lib/db";
import { bad, fail } from "@/lib/validate";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return bad("Not found", 404);
  try {
    const { rows } = await db.query("SELECT image, image_mime FROM looks WHERE id = $1", [id]);
    if (!rows.length) return bad("Not found", 404);
    return new Response(rows[0].image, {
      headers: { "content-type": rows[0].image_mime, "cache-control": "public, max-age=31536000, immutable" },
    });
  } catch (e) {
    return fail(e);
  }
}
