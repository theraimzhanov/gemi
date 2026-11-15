/* eslint-disable @typescript-eslint/no-explicit-any -- provider payloads captured at the HTTP boundary */
import assert from "node:assert/strict";
import { cheapestSelection, selectCandidates, validPreferences, type Shopping } from "../lib/styling.ts";
import { publicProductUrl } from "../lib/product-image.ts";
import { isImg, publicMessage } from "../lib/validate.ts";
import { extractGarments, generateTryOn, routeIntent, shopGarments, ShoppingError, type Garment } from "../lib/gemini.ts";

const garment = (category: string, price_usd: number, id = category): Garment => ({ category, price_usd, description: id, color: "red", price_is_estimate: false, url: `https://store.invalid/${id}` });
const shopping: Shopping = { request: "outfit", budget: 50, categories: ["top", "shoes"], candidates: [garment("top", 20), garment("top", 40, "premium"), garment("shoes", 30)].map((garment) => ({ garment })) };
assert.deepEqual(cheapestSelection(shopping), [0, 2]);
assert.equal(selectCandidates(shopping, [0, 2]).length, 2);
for (const bad of [[1, 2], [0, 0], [0], [0, 99], [-1, 2], [0, 1.5], ["0", 2], null]) assert.throws(() => selectCandidates(shopping, bad));
assert.throws(() => selectCandidates({ ...shopping, categories: ["dress"], candidates: [] }, [-1]));
assert.equal(selectCandidates({ ...shopping, budget: 0.3, candidates: [garment("top", 0.1), garment("shoes", 0.2)].map((garment) => ({ garment })) }, [0, 1]).length, 2);
assert.ok(validPreferences({ gender: "unisex", size: "M", style: "minimal" }));
assert.ok(!validPreferences({ gender: 4, size: "", style: "" }));
assert.ok(!validPreferences({ gender: "", size: "", style: "a".repeat(201) }));
for (const url of ["http://shop.com", "https://127.0.0.1", "https://user:pass@shop.com", "https://shop.com:444", "https://app.internal", "javascript:alert(1)"]) assert.ok(!publicProductUrl(url));
assert.ok(publicProductUrl("https://retailer.example/product"));
assert.ok(isImg({ mime: "image/jpeg", data: "YWJj" }));
assert.ok(!isImg({ mime: "image/svg+xml", data: "YWJj" }));
assert.ok(!isImg({ mime: "image/jpeg", data: "<script>" }));
assert.match(publicMessage({ status: 429 }), /try again/i);
console.log("ok selection validation, exact budget boundary, preferences, URLs and uploads");

// Fake provider responses test the real request builders without spending credits.
process.env.OPENROUTER_API_KEY = "offline-test";
process.env.GEMINI_API_KEY = "offline-test";
let queue: object[] = [];
const calls: Record<string, any>[] = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  assert.match(String(url), /^https:\/\/openrouter.ai\//);
  calls.push(JSON.parse(String(init?.body)));
  assert.ok(queue.length, "Unexpected provider call");
  return Response.json(queue.shift());
};
const answer = (content: unknown) => ({ choices: [{ message: { content: typeof content === "string" ? content : JSON.stringify(content) } }] });
const photo = { mime: "image/jpeg", data: "YWJj" };
try {
  queue = [{ choices: [{ message: { tool_calls: [{ function: { name: "steal_look", arguments: JSON.stringify({ instruction: "use the boots and keep the jacket" }) } }] } }] }];
  const intent = await routeIntent({ text: "use these boots", outfits: [photo, photo, photo, photo], hasOutfitPhoto: true, hasCurrentLook: true });
  assert.equal(intent.tool, "steal_look");
  assert.equal(calls.at(-1)!.messages[1].content.filter((p: any) => p.type === "image_url").length, 4);

  queue = [{ choices: [{ message: { tool_calls: [{ function: { name: "steal_look", arguments: JSON.stringify({ instruction: "wear the boots from my photo" }) } }] } }] }];
  const voice = await routeIntent({ audio: { mime: "audio/wav", data: "YWJj" }, outfits: [photo], hasOutfitPhoto: true, hasCurrentLook: false });
  assert.equal(voice.tool, "steal_look");
  assert.ok(voice.tool === "steal_look" && voice.instruction?.includes("boots"));
  assert.ok(calls.at(-1)!.messages[1].content.some((p: any) => p.type === "input_audio"));

  queue = [answer({ garments: [garment("shoes", 20)] })];
  await extractGarments([photo, photo, photo, photo], "keep my jacket");
  assert.match(calls.at(-1)!.messages[0].content[0].text, /keep my jacket/);
  assert.equal(calls.at(-1)!.messages[0].content.filter((p: any) => p.type === "image_url").length, 4);

  queue = [{ data: [{ b64_json: "YWJj", media_type: "image/png" }] }];
  await generateTryOn(photo, [garment("top", 20)], Array(13).fill(photo), ["top"], "keep my glasses");
  assert.equal(calls.at(-1)!.input_references.length, 14);
  assert.match(calls.at(-1)!.prompt, /Change only these parts of the outfit: top/);
  assert.match(calls.at(-1)!.prompt, /keep my glasses/);

  queue = [answer("expensive"), answer({ garments: [garment("top", 40), garment("shoes", 40)] }), answer("cheaper"), answer({ garments: [garment("top", 20), garment("shoes", 30)] })];
  const result = await shopGarments("outfit", 50, ["top", "shoes"], "menswear, M");
  assert.equal(selectCandidates(result, cheapestSelection(result)).length, 2);
  assert.ok(calls.some((c) => JSON.stringify(c).includes("menswear, M")));
  assert.ok(calls.some((c) => JSON.stringify(c).includes("previous search was over budget")));

  queue = [answer("too expensive"), answer({ garments: [garment("top", 100)] }), answer("still expensive"), answer({ garments: [garment("top", 100)] })];
  await assert.rejects(() => shopGarments("top", 10, ["top"]), ShoppingError);
  queue = [answer({ garments: [{ ...garment("top", 1), price_usd: "bad" }] })];
  await assert.rejects(() => extractGarments(photo), /Invalid garment response/);
  assert.equal(queue.length, 0);
  console.log("ok multimodal routing, all references, generation instructions, budget re-search and model-output validation");
} finally { globalThis.fetch = originalFetch; }
