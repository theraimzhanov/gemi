// Run:  node --env-file=.env.local scripts/seed.ts
// Fills the community feed with demo looks and writes the landing-page pictures.
// Pictures are cached on disk, so a re-run never generates (or pays for) the same picture twice.
// To use pictures from another source, drop them in at the paths printed below and re-run.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { db, toVector } from "../lib/db.ts";
import { describe, embed, generateImage, totalUsd, type Garment, type Img } from "../lib/gemini.ts";

const g = (category: string, description: string, color: string, price_usd: number): Garment =>
  ({ category, description, color, price_usd, price_is_estimate: true });

const LOOKS: { slug: string; author: string; model: string; setting: string; garments: Garment[] }[] = [
  { slug: "city-red", author: "maya", model: "a woman in her twenties", setting: "a city street at golden hour",
    garments: [g("dress", "flowing wrap midi dress", "red", 78), g("shoes", "block-heel sandals", "tan", 55), g("accessory", "small crossbody bag", "black", 40)] },
  { slug: "street-denim", author: "leo", model: "a man in his twenties", setting: "a concrete skate park",
    garments: [g("outerwear", "oversized denim jacket", "light blue", 89), g("top", "heavyweight crew-neck tee", "white", 25), g("bottom", "relaxed cargo trousers", "olive", 60), g("shoes", "low-top leather sneakers", "white", 85)] },
  { slug: "office-beige", author: "sofia", model: "a woman in her thirties", setting: "a bright modern office lobby",
    garments: [g("outerwear", "single-breasted blazer", "beige", 120), g("top", "silk-blend camisole", "ivory", 45), g("bottom", "wide-leg tailored trousers", "beige", 80), g("shoes", "pointed-toe loafers", "black", 95)] },
  { slug: "summer-linen", author: "amir", model: "a man in his thirties", setting: "a seaside promenade",
    garments: [g("top", "short-sleeve linen shirt", "sky blue", 48), g("bottom", "pleated linen shorts", "cream", 42), g("shoes", "suede espadrilles", "navy", 65), g("accessory", "round sunglasses", "tortoiseshell", 30)] },
  { slug: "night-black", author: "maya", model: "a woman in her twenties", setting: "a rooftop bar at night with city lights",
    garments: [g("dress", "satin slip mini dress", "black", 92), g("outerwear", "cropped leather biker jacket", "black", 180), g("shoes", "strappy heeled sandals", "silver", 70)] },
  { slug: "campus-green", author: "jun", model: "a college student", setting: "a tree-lined university walkway in autumn",
    garments: [g("top", "varsity crewneck sweatshirt", "forest green", 55), g("bottom", "straight-leg jeans", "indigo", 68), g("shoes", "retro running sneakers", "grey and white", 90), g("accessory", "canvas tote bag", "natural", 18)] },
  { slug: "boho-floral", author: "sofia", model: "a woman in her twenties", setting: "a sunlit flower market",
    garments: [g("dress", "tiered floral maxi dress", "sage green", 85), g("outerwear", "cropped knit cardigan", "cream", 50), g("shoes", "leather ankle boots", "brown", 110), g("accessory", "woven straw hat", "natural", 28)] },
  { slug: "sport-mono", author: "leo", model: "an athletic man in his twenties", setting: "an urban running track at sunrise",
    garments: [g("outerwear", "lightweight zip running jacket", "charcoal", 75), g("top", "technical training tee", "black", 30), g("bottom", "tapered jogger pants", "charcoal", 55), g("shoes", "cushioned running shoes", "neon yellow", 130)] },
];

const STARTERS: Record<string, string> = {
  steal: "Two people side by side wearing the exact same stylish streetwear outfit, like a mirror image, studio backdrop, editorial fashion photograph",
  shop: "A red dress on a hanger beside neatly arranged shopping bags and a price tag, soft studio light, editorial product photograph",
  piece: "A single folded blue knit top on a marble surface, top-down, minimal, soft shadows, editorial product photograph",
  closet: "A tidy open wardrobe with a colour-ordered rail of clothes and a row of white sneakers below, warm light, editorial photograph",
};

async function picture(path: string, prompt: string, aspect: string): Promise<Img | null> {
  if (!existsSync(path)) {
    try {
      const made = await generateImage(prompt, aspect);
      writeFileSync(path, Buffer.from(made.data, "base64"));
      console.log("made", path);
    } catch (e) {
      console.log("skip", path, "-", String((e as Error).message).slice(0, 110));
      return null;
    }
  }
  const bytes = readFileSync(path);
  return { mime: bytes[0] === 0xff ? "image/jpeg" : bytes[0] === 0x52 ? "image/webp" : "image/png", data: bytes.toString("base64") };
}

mkdirSync("public/starters", { recursive: true });
mkdirSync("seed", { recursive: true });

for (const [name, prompt] of Object.entries(STARTERS)) await picture(`public/starters/${name}.png`, `${prompt}. Photorealistic, no text.`, "4:3");

// Demo accounts own the seeded looks; "!" is not a valid hash, so nobody can log in as them.
const authors = [...new Set(LOOKS.map((l) => l.author))];
for (const a of authors) await db.query("INSERT INTO users (username, password_hash) VALUES ($1, '!') ON CONFLICT DO NOTHING", [a]);
const users = (await db.query("SELECT id FROM users WHERE username = ANY($1)", [authors])).rows.map((r) => r.id);

let added = 0;
for (const look of LOOKS) {
  const garments = JSON.stringify(look.garments);
  if ((await db.query("SELECT 1 FROM looks WHERE author = $1 AND garments = $2::jsonb", [look.author, garments])).rowCount) continue;
  const img = await picture(
    `seed/${look.slug}.png`,
    `Full-body editorial fashion photograph of ${look.model} wearing ${describe(look.garments)}. Setting: ${look.setting}. ` +
      "Whole outfit visible from head to shoes, natural light, photorealistic, no text.",
    "3:4",
  );
  if (!img) continue;
  const bytes = Buffer.from(img.data, "base64");
  const { rows } = await db.query(
    `INSERT INTO looks (author, image, image_mime, garments, total_usd, embedding, created_at)
     VALUES ($1, $2, $3, $4, $5, $6::vector, now() - random() * interval '3 days') RETURNING id`,
    [look.author, bytes, img.mime, garments, totalUsd(look.garments), toVector(await embed(describe(look.garments)))],
  );
  // The look's own picture is its garment reference, which is what makes one-click try-on work.
  await db.query("INSERT INTO garment_refs (look_id, image, mime) VALUES ($1, $2, $3)", [rows[0].id, bytes, img.mime]);
  for (const u of users.filter(() => Math.random() < 0.6))
    await db.query("INSERT INTO look_events (time, look_id, kind, user_id) VALUES (now() - random() * interval '20 hours', $1, 'like', $2)", [rows[0].id, u]);
  for (let i = Math.floor(Math.random() * 5); i > 0; i--)
    await db.query("INSERT INTO look_events (time, look_id, kind) VALUES (now() - random() * interval '20 hours', $1, 'tryon')", [rows[0].id]);
  added++;
}
console.log(`done: ${added} look(s) added, ${(await db.query("SELECT count(*)::int AS n FROM looks")).rows[0].n} in the feed`);
await db.end();
