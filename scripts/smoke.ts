// Run:  node --env-file=.env.local scripts/smoke.ts [selfie.jpg outfit.jpg]
// Offline checks always run; Gemini checks need GEMINI_API_KEY; the photo path also needs the two image paths.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { extractGarments, generateTryOn, routeIntent, shopGarments, totalUsd, type Garment, type Img } from "../lib/gemini.ts";

const g = (price_usd: number): Garment => ({ category: "top", description: "tee", color: "blue", price_usd, price_is_estimate: true });
assert.equal(totalUsd([g(19.99), g(30.01), g(0.1)]), 50.1);
assert.equal(totalUsd([{ ...g(5), price_usd: "oops" as unknown as number }]), 0);
console.log("ok  receipt total");

if (!process.env.GEMINI_API_KEY) {
  console.log("skip Gemini checks: GEMINI_API_KEY is not set");
  process.exit(0);
}

const ctx = { hasOutfitPhoto: false, hasCurrentLook: true };
const cases: [string, string, typeof ctx][] = [
  ["find a $100 red dress", "shop_and_dress", ctx],
  ["I only need a blue top", "shop_and_dress", ctx],
  ["swap the heels for sneakers", "micro_edit", ctx],
  ["show me community looks like this streetwear outfit", "find_similar", ctx],
  ["put this outfit on me", "steal_look", { hasOutfitPhoto: true, hasCurrentLook: false }],
];
for (const [text, want, c] of cases) {
  const intent = await routeIntent({ text, ...c });
  assert.equal(intent.tool, want, `"${text}" routed to ${intent.tool}`);
  if (text.includes("blue top")) assert.deepEqual((intent as { categories: string[] }).categories, ["top"]);
  if (text.includes("$100")) assert.equal((intent as { budget_usd?: number }).budget_usd, 100);
}
console.log("ok  router");

const shop = await shopGarments("red dress", 100, ["dress"]);
assert.ok(shop.garments.length >= 1, "shopping returned no items");
assert.ok(shop.garments.some((x) => x.url?.startsWith("https://")), "no item has a store link");
assert.ok(totalUsd(shop.garments) <= 100, `over budget: $${totalUsd(shop.garments)}`);
console.log(`ok  shopping (${shop.garments.length} item(s), ${shop.refs.length} product photo(s))`);

const [selfiePath, outfitPath] = process.argv.slice(2);
if (!selfiePath || !outfitPath) {
  console.log("skip photo try-on: pass selfie and outfit image paths");
  process.exit(0);
}
const load = (p: string): Img => ({ mime: p.endsWith(".png") ? "image/png" : "image/jpeg", data: readFileSync(p).toString("base64") });
const garments = await extractGarments(load(outfitPath));
assert.ok(garments.length >= 1);
const out = await generateTryOn(load(selfiePath), garments, [load(outfitPath)]);
assert.ok(out.data.length > 1000, "try-on returned no image");
writeFileSync("smoke-out.png", Buffer.from(out.data, "base64"));
console.log(`ok  photo try-on (${garments.length} garments, total $${totalUsd(garments)}) -> smoke-out.png`);
