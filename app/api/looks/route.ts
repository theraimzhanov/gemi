import { db, toVector } from "@/lib/db";
import { describe, embed, totalUsd } from "@/lib/gemini";
import { bad, fail, isGarments, isImg } from "@/lib/validate";

export async function GET(req: Request) {
  const newest = new URL(req.url).searchParams.get("sort") === "new";
  try {
    const { rows } = await db.query(
      `SELECT l.id, l.author, l.garments, l.total_usd, l.created_at,
              count(*) FILTER (WHERE e.kind = 'like')::int  AS likes,
              count(*) FILTER (WHERE e.kind = 'tryon')::int AS tryons,
              count(*) FILTER (WHERE e.time > now() - interval '24 hours')::int AS hot
       FROM looks l LEFT JOIN look_events e ON e.look_id = l.id
       GROUP BY l.id
       ORDER BY ${newest ? "l.created_at DESC" : "hot DESC, l.created_at DESC"}
       LIMIT 60`,
    );
    return Response.json(rows);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const author = typeof b?.author === "string" ? b.author.trim().slice(0, 40) : "";
  if (!author) return bad("Enter a display name before sharing.");
  if (!isImg(b.image) || !isGarments(b.garments)) return bad("Nothing to share yet.");
  const refs = (Array.isArray(b.refs) ? b.refs : []).filter((r: unknown) => isImg(r)).slice(0, 8);
  // Keep only the fields we know, so the feed never renders arbitrary client data.
  const garments = b.garments.map((g: Record<string, unknown>) => ({
    category: String(g.category).slice(0, 40),
    description: String(g.description).slice(0, 300),
    color: String(g.color).slice(0, 60),
    price_usd: Math.max(0, Number(g.price_usd) || 0),
    price_is_estimate: g.price_is_estimate !== false,
    url: typeof g.url === "string" && /^https:\/\//.test(g.url) ? g.url.slice(0, 600) : undefined,
  }));

  const client = await db.connect();
  try {
    const embedding = await embed(describe(garments));
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO looks (author, image, image_mime, garments, total_usd, embedding)
       VALUES ($1, $2, $3, $4, $5, $6::vector) RETURNING id`,
      [author, Buffer.from(b.image.data, "base64"), b.image.mime, JSON.stringify(garments), totalUsd(garments), toVector(embedding)],
    );
    for (const r of refs)
      await client.query("INSERT INTO garment_refs (look_id, image, mime) VALUES ($1, $2, $3)", [
        rows[0].id, Buffer.from(r.data, "base64"), r.mime,
      ]);
    await client.query("COMMIT");
    return Response.json({ id: rows[0].id });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    return fail(e);
  } finally {
    client.release();
  }
}
