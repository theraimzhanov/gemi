import { GoogleGenAI } from "@google/genai";
import { cheapestSelection, selectCandidates, MAX_PHOTOS, type Shopping } from "./styling.ts";
import { fetchProductImage, publicProductUrl } from "./product-image.ts";

const FLASH = "gemini-3.8-flash";
const FLASH_FALLBACK = "gemini-3.6-flash";
const IMAGE = "gemini-nano-banana-2.1";
const EMBED = "gemini-embedding-2";

export type Img = { mime: string; data: string }; // data is base64
export type Garment = {
  category: string;
  description: string;
  color: string;
  price_usd: number;
  price_is_estimate: boolean;
  url?: string;
};
export type Intent =
  | { tool: "steal_look"; instruction?: string }
  | { tool: "shop_and_dress"; request: string; budget_usd?: number; categories: string[] }
  | { tool: "micro_edit"; instruction: string }
  | { tool: "find_similar"; query: string }
  | { tool: "none"; message: string };

export const CATEGORIES = ["top", "bottom", "dress", "outerwear", "shoes", "accessory"];

export const totalUsd = (garments: Garment[]) =>
  Math.round(garments.reduce((sum, g) => sum + (Number(g.price_usd) || 0), 0) * 100) / 100;

export const describe = (garments: Garment[]) =>
  garments.map((g) => `${g.color} ${g.description} (${g.category})`).join("; ");

type Interaction = {
  output_text?: string;
  output_image?: { data?: string; mime_type?: string };
  steps?: { type: string; name?: string; arguments?: Record<string, unknown> }[];
};

export class BusyError extends Error {
  constructor() {
    super("Gemini is overloaded right now and did not answer in time. Please try again in a minute.");
  }
}

export class PictureCreditError extends Error {
  constructor() {
    super("Gemi has run out of picture credits, so it cannot make a look right now.");
  }
}

let client: GoogleGenAI | undefined;
function create(params: Record<string, unknown>): Promise<Interaction> {
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const original = params;
  // The v1 API wants content parts wrapped in a user_input step.
  if (Array.isArray(params.input)) params = { ...params, input: [{ type: "user_input", content: params.input }] };
  // The SDK's param union is very wide; our call shapes are checked by scripts/smoke.ts instead.
  const attempt = (p: Record<string, unknown>, ms: number) =>
    // The SDK retries overloaded (503) responses silently for minutes; give up with a clear message instead.
    Promise.race([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client!.interactions.create(p as any) as Promise<Interaction>,
      new Promise<never>((_, reject) => setTimeout(() => reject(new BusyError()), ms).unref?.()),
    ]);
  if (params.model !== FLASH) return attempt(params, 120_000);
  // When the newest Flash model is overloaded, the previous stable one usually still answers.
  const google = () =>
    attempt(params, 30_000).catch((e) => {
      if (!(e instanceof BusyError) && e?.status !== 503 && e?.status !== 429) throw e;
      return attempt({ ...params, model: FLASH_FALLBACK }, 90_000);
    });
  // Google's free tier is often slow or over quota, so text calls go to the same Gemini model on OpenRouter
  // first when a key is set. Any failure there (including no credits) falls back to Google.
  if (!process.env.OPENROUTER_API_KEY) return google();
  return flashOnOpenRouter(original).catch((e) => {
    console.error("OpenRouter text call failed, using Google:", String(e?.message ?? e).slice(0, 200));
    return google();
  });
}

type Part = { type: string; text?: string; mime_type?: string; data?: string };
type Tool = { type: string; name?: string; description?: string; parameters?: unknown };

// Translates one of our Flash calls into OpenRouter's chat format and its answer back into ours.
async function flashOnOpenRouter(p: Record<string, unknown>): Promise<Interaction> {
  const input = p.input as string | Part[];
  const content = typeof input === "string" ? input : input.map((x) =>
    x.type === "image" ? { type: "image_url", image_url: { url: `data:${x.mime_type};base64,${x.data}` } }
    : x.type === "audio" ? { type: "input_audio", input_audio: { data: x.data, format: "wav" } }
    : x);
  const tools = (p.tools as Tool[] | undefined) ?? [];
  const functions = tools.filter((t) => t.type === "function")
    .map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
  const schema = (p.response_format as { schema?: unknown } | undefined)?.schema;
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      // ":online" turns on web search, our stand-in for Google Search grounding.
      model: `google/${FLASH}${tools.some((t) => t.type === "google_search") ? ":online" : ""}`,
      messages: [
        ...(p.system_instruction ? [{ role: "system", content: p.system_instruction }] : []),
        { role: "user", content },
      ],
      ...(functions.length ? { tools: functions } : {}),
      ...(schema ? { response_format: { type: "json_schema", json_schema: { name: "result", schema } } } : {}),
    }),
    signal: AbortSignal.timeout(tools.some((t) => t.type === "google_search") ? 120_000 : 60_000),
  });
  const body = await res.json().catch((e) => {
    if (e?.name === "AbortError" || e?.name === "TimeoutError") throw new BusyError();
    throw new Error("OpenRouter returned an unreadable response");
  });
  const message = body?.choices?.[0]?.message;
  if (!res.ok || !message) throw Object.assign(new Error(body?.error?.message ?? `OpenRouter answered ${res.status} without a message`), { status: body?.error?.code ?? res.status });
  const call = message.tool_calls?.[0]?.function;
  return {
    output_text: typeof message.content === "string" ? message.content : "",
    steps: call ? [{ type: "function_call", name: call.name, arguments: JSON.parse(call.arguments || "{}") }] : [],
  };
}

const text = (t: string) => ({ type: "text", text: t });
const image = (i: Img) => ({ type: "image", mime_type: i.mime, data: i.data });

const garmentListSchema = {
  type: "object",
  properties: {
    garments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string", enum: CATEGORIES },
          description: { type: "string" },
          color: { type: "string" },
          price_usd: { type: "number" },
          price_is_estimate: { type: "boolean" },
          url: { type: "string" },
        },
        required: ["category", "description", "color", "price_usd", "price_is_estimate"],
      },
    },
  },
  required: ["garments"],
};

async function garmentJson(input: unknown): Promise<Garment[]> {
  const r = await create({
    model: FLASH,
    input,
    response_format: { type: "text", mime_type: "application/json", schema: garmentListSchema },
  });
  const parsed = JSON.parse(r.output_text ?? "{}");
  if (!Array.isArray(parsed.garments) || !parsed.garments.length || parsed.garments.length > 30 ||
      !parsed.garments.every((g: Garment) => g && CATEGORIES.includes(g.category) &&
        typeof g.description === "string" && g.description.length <= 600 && typeof g.color === "string" &&
        Number.isFinite(g.price_usd) && g.price_usd >= 0 && typeof g.price_is_estimate === "boolean"))
    throw new Error("Invalid garment response");
  return parsed.garments;
}

export async function routeIntent(input: {
  text?: string;
  audio?: Img;
  hasOutfitPhoto: boolean;
  outfits?: Img[];
  hasCurrentLook: boolean;
}): Promise<Intent> {
  const str = { type: "string" };
  const fn = (name: string, description: string, properties: object, required: string[]) => ({
    type: "function",
    name,
    description,
    parameters: { type: "object", properties, required },
  });
  const r = await create({
    model: FLASH,
    system_instruction:
      "You route requests for a fashion try-on app. Call exactly one function. " +
      `Context: outfit photo attached = ${input.hasOutfitPhoto}; user already has a generated look = ${input.hasCurrentLook}. ` +
      "The request may be text, photos, a voice recording, or all three. When reference photos are attached, use steal_look to apply them, including requested modifications. Transcribe voice instructions into the instruction field. Do not ignore attachments.",
    input: [
      text(input.text?.trim() || "(no text; listen to the audio)"),
      ...(input.outfits ?? []).map(image),
      ...(input.audio ? [{ type: "audio", mime_type: input.audio.mime, data: input.audio.data }] : []),
    ],
    tools: [
      fn("steal_look", "Apply the garments from attached photos, respecting the user instructions. A product photo changes only that item; a whole outfit photo copies every visible item. Only when photos are attached.", { instruction: str }, ["instruction"]),
      fn(
        "shop_and_dress",
        "Search the web for real clothes to buy and dress the user in them. Use for requests like 'find a $100 red dress' or 'I only need a blue top'.",
        {
          request: { ...str, description: "What to look for, in the user's words, in English" },
          budget_usd: { type: "number", description: "Total budget in USD, if the user gave one" },
          categories: {
            type: "array",
            items: { ...str, enum: CATEGORIES },
            description: "Only the garment categories the user asked for. A full outfit lists every category needed.",
          },
        },
        ["request", "categories"],
      ),
      fn(
        "micro_edit",
        "Change one detail of the user's current generated look without shopping, e.g. 'swap heels for sneakers'. Only when the user already has a look.",
        { instruction: str },
        ["instruction"],
      ),
      fn("find_similar", "Find looks in the community feed similar to a description.", { query: str }, ["query"]),
    ],
  });
  const call = r.steps?.find((s) => s.type === "function_call");
  const a = (call?.arguments ?? {}) as Record<string, never>;
  switch (call?.name) {
    case "steal_look":
      return { tool: "steal_look", instruction: String(a.instruction ?? input.text ?? "") };
    case "shop_and_dress":
      return {
        tool: "shop_and_dress",
        request: String(a.request ?? ""),
        budget_usd: a.budget_usd == null ? undefined : Number(a.budget_usd),
        categories: (Array.isArray(a.categories) ? (a.categories as string[]) : []).filter((c) => CATEGORIES.includes(c)),
      };
    case "micro_edit":
      return { tool: "micro_edit", instruction: String(a.instruction ?? "") };
    case "find_similar":
      return { tool: "find_similar", query: String(a.query ?? "") };
    default:
      return { tool: "none", message: r.output_text || "I couldn't tell what you want. Try: 'find a $100 red dress'." };
  }
}

export function extractGarments(outfit: Img | Img[], instruction = ""): Promise<Garment[]> {
  return garmentJson([
    text(
      "Identify the garments and accessories to apply from these reference photos. Photos may show individual products, flat lays, or full outfits on people. " +
        "For a product photo include only the featured product, not a model's incidental styling. For an outfit photo include every worn piece. Deduplicate repeated items. " +
        `Follow the user instructions to select or modify the items: ${instruction || "Use the featured products or full outfit shown"}. ` +
        "For each give category, a specific description, color, and your best estimate of its retail price in USD. " +
        "Set price_is_estimate to true and leave url out.",
    ),
    ...(Array.isArray(outfit) ? outfit : [outfit]).map(image),
  ]);
}

export async function shopGarments(
  request: string,
  budget: number | undefined,
  categories: string[],
  preferences = "",
): Promise<Shopping> {
  if (budget !== undefined && (!Number.isFinite(budget) || budget <= 0)) throw new Error("Invalid budget");
  for (let attempt = 0; attempt < 2; attempt++) {
    const found = await create({
      model: FLASH,
      tools: [{ type: "google_search" }],
      input:
        `Find real clothes currently for sale online for this request: ${JSON.stringify(request)}. ` +
        `Offer up to three different products per category: ${categories.join(", ") || "the categories needed for this request"}. ` +
        (budget !== undefined ? `A complete selection of one item per category MUST fit a TOTAL budget of $${budget} USD, before tax/shipping. ${attempt ? "The previous search was over budget or incomplete. Search cheaper retailers and complete every requested category. " : ""}` : "") +
        `Shopping preferences (never infer gender from a photo): ${preferences || "Unspecified; prefer unisex where appropriate"}. ` +
        "The explicit request takes priority over style preferences. Give each product's name, color, current USD price and direct retailer product-page URL. Do not invent prices or URLs. Mention size availability only if verified. Keep the answer concise.",
    });
    const raw = await garmentJson(
      "Convert the shopping answer to garments, preserving ALL alternatives. Use only stated USD prices and exact product URLs. " +
      "Set price_is_estimate=false only for stated prices; omit products with unknown prices.\n" + (found.output_text ?? ""),
    );
    const garments = raw.filter((g) => CATEGORIES.includes(g.category) &&
      (!categories.length || categories.includes(g.category)) && typeof g.description === "string" && typeof g.color === "string" &&
      Number.isFinite(g.price_usd) && g.price_usd > 0 && !g.price_is_estimate && publicProductUrl(g.url));
    const needed = categories.length ? [...new Set(categories)] : [...new Set(garments.map((g) => g.category))];
    const candidates = needed.flatMap((category) => garments.filter((g) => g.category === category)
      .filter((g, i, all) => all.findIndex((other) => other.url === g.url) === i).slice(0, 3).map((garment) => ({ garment })));
    const shopping: Shopping = { request, budget, categories: needed, candidates };
    try {
      if (!needed.length) throw new Error("No priced products");
      selectCandidates(shopping, cheapestSelection(shopping));
    } catch { continue; }
    await Promise.all(shopping.candidates.map(async (candidate) => {
      const photo = await fetchProductImage(candidate.garment.url);
      if (photo) candidate.image = photo;
    }));
    return shopping;
  }
  throw new ShoppingError("I couldn't find a complete set with listed prices within your budget. Try a higher budget or fewer pieces.");
}

export class ShoppingError extends Error {}

// One place that makes a picture. Google's free tier refuses its image models, so when an OpenRouter key
// is set the same Gemini image model is called through OpenRouter; otherwise Google is called directly.
async function makeImage(prompt: string, images: Img[], aspect_ratio: string): Promise<Img> {
  if (!process.env.OPENROUTER_API_KEY) {
    const r = await create({ model: IMAGE, input: [text(prompt), ...images.map(image)], response_format: { type: "image", aspect_ratio } });
    if (!r.output_image?.data) throw new Error(r.output_text || "The image model returned no image");
    return { mime: r.output_image.mime_type ?? "image/png", data: r.output_image.data };
  }
  const res = await fetch("https://openrouter.ai/api/v1/images", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: `google/${IMAGE}`,
      prompt,
      aspect_ratio,
      input_references: images.map((i) => ({ type: "image_url", image_url: { url: `data:${i.mime};base64,${i.data}` } })),
    }),
    signal: AbortSignal.timeout(120_000),
  }).catch(() => { throw new BusyError(); });
  const body = await res.json().catch(() => null);
  const out = body?.data?.[0];
  if (res.status === 402) throw new PictureCreditError();
  if (!res.ok || !out?.b64_json) throw Object.assign(new Error(body?.error?.message ?? "The image model returned no image"), { status: res.status });
  return { mime: out.media_type ?? "image/png", data: out.b64_json };
}

export async function generateTryOn(person: Img, garments: Garment[], refs: Img[], onlyCategories?: string[], instruction = ""): Promise<Img> {
  const scope = onlyCategories?.length
    ? `Change only these parts of the outfit: ${onlyCategories.join(", ")}. Within these categories replace ONLY the listed products (for example glasses, not all accessories). Keep every other piece of clothing and accessory exactly as it is.`
    : "Replace their whole outfit.";
  return makeImage(
    "The first image is a photo of a person. Dress this exact person in the garments listed below. " +
      "Keep their face, hair, skin tone, body proportions, pose and background unchanged. " +
      `${scope}
User instructions: ${instruction || "Match the reference garments"}. Respect layering, colors and exclusions requested.
Garments: ${describe(garments)}.
` +
      (refs.length
        ? "The remaining images are reference pictures of those garments; match them closely and ignore any person shown in them. "
        : "") +
      "Output one photorealistic full-body image.",
    [person, ...refs.slice(0, MAX_PHOTOS)],
    "3:4",
  );
}

export async function editLook(current: Img, instruction: string): Promise<Img> {
  return makeImage(
    `Edit this image: ${instruction}. Change only that. Keep the person's face, body, pose, background and every other garment exactly the same.`,
    [current],
    "3:4",
  );
}

export async function generateImage(prompt: string, aspect_ratio = "3:4"): Promise<Img> {
  return makeImage(prompt, [], aspect_ratio);
}

export async function embed(content: string): Promise<number[]> {
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const r = await client.models.embedContent({ model: EMBED, contents: content, config: { outputDimensionality: 768 } });
  const values = r.embeddings?.[0]?.values;
  if (!values?.length) throw new Error("No embedding returned");
  return values;
}
