import type { User } from "./auth";
import { db } from "./db";
import { totalUsd, type Garment, type Img } from "./gemini";
import { MAX_PHOTOS } from "./styling";

// Keep only the fields we know: part of a garment list can come from the browser, and shared looks are shown to everyone.
export const cleanGarments = (garments: Garment[]): Garment[] =>
  garments.map((g) => ({
    category: String(g.category).slice(0, 40),
    description: String(g.description).slice(0, 300),
    color: String(g.color).slice(0, 60),
    price_usd: Math.max(0, Number(g.price_usd) || 0),
    price_is_estimate: g.price_is_estimate !== false,
    url: typeof g.url === "string" && /^https:\/\//.test(g.url) ? g.url.slice(0, 600) : undefined,
  }));

// Saves a generated look as private to its owner and returns its id.
export async function saveLook(user: User, image: Img, garments: Garment[], refs: Img[]): Promise<number> {
  const clean = cleanGarments(garments);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO looks (author, user_id, image, image_mime, garments, total_usd)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [user.username, user.id, Buffer.from(image.data, "base64"), image.mime, JSON.stringify(clean), totalUsd(clean)],
    );
    for (const r of refs.slice(0, MAX_PHOTOS))
      await client.query("INSERT INTO garment_refs (look_id, image, mime) VALUES ($1, $2, $3)", [
        rows[0].id, Buffer.from(r.data, "base64"), r.mime,
      ]);
    await client.query("COMMIT");
    return Number(rows[0].id);
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
