import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { bad, fail } from "@/lib/validate";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return bad("Not found", 404);
  try {
    const { rows } = await db.query("SELECT image, image_mime, shared, user_id FROM looks WHERE id = $1", [id]);
    if (!rows.length) return bad("Not found", 404);
    // Private looks are visible to their owner only.
    if (!rows[0].shared && String((await currentUser())?.id) !== String(rows[0].user_id)) return bad("Not found", 404);
    return new Response(rows[0].image, {
      headers: {
        "content-type": rows[0].image_mime,
        "cache-control": rows[0].shared ? "public, max-age=86400" : "private, max-age=86400",
        // Illustrations are SVG: never let one run scripts if opened directly.
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
        "x-content-type-options": "nosniff",
        ...(new URL(req.url).searchParams.has("download")
          ? { "content-disposition": `attachment; filename="gemi-look-${id}.${rows[0].image_mime === "image/jpeg" ? "jpg" : rows[0].image_mime === "image/webp" ? "webp" : "png"}"` } : {}),
      },
    });
  } catch (e) {
    return fail(e);
  }
}
