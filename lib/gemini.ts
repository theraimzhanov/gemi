import { GoogleGenAI } from "@google/genai";

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
  | { tool: "steal_look" }
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
  return attempt(params, 30_000).catch((e) => {
    if (!(e instanceof BusyError) && e?.status !== 503 && e?.status !== 429) throw e;
    return attempt({ ...params, model: FLASH_FALLBACK }, 90_000);
  });
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
  if (!Array.isArray(parsed.garments) || !parsed.garments.length) throw new Error("No garments found");
  return parsed.garments;
}

export async function routeIntent(input: {
  text?: string;
  audio?: Img;
  hasOutfitPhoto: boolean;
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
      "The request may be text, a voice recording, or both.",
    input: [
      text(input.text?.trim() || "(no text; listen to the audio)"),
      ...(input.audio ? [{ type: "audio", mime_type: input.audio.mime, data: input.audio.data }] : []),
    ],
    tools: [
      fn("steal_look", "Copy the whole outfit from the attached outfit photo onto the user. Only when an outfit photo is attached.", {}, []),
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
      return { tool: "steal_look" };
    case "shop_and_dress":
      return {
        tool: "shop_and_dress",
        request: String(a.request ?? ""),
        budget_usd: Number(a.budget_usd) || undefined,
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

export function extractGarments(outfit: Img): Promise<Garment[]> {
  return garmentJson([
    text(
      "List every visible garment and accessory the person in this photo is wearing. " +
        "For each give category, a specific description, color, and your best estimate of its retail price in USD. " +
        "Set price_is_estimate to true and leave url out.",
    ),
    image(outfit),
  ]);
}

export async function shopGarments(
  request: string,
  budget: number | undefined,
  categories: string[],
): Promise<{ garments: Garment[]; refs: Img[] }> {
  const found = await create({
    model: FLASH,
    tools: [{ type: "google_search" }],
    input:
      `Find real clothes currently for sale online for this request: "${request}". ` +
      `Pick exactly one item for each of these categories: ${categories.join(", ") || "whatever the request needs"}. ` +
      (budget ? `The total must not exceed $${budget}. ` : "") +
      "For each item give the product name, color, price in USD, and the direct product page URL from a retailer.",
  });
  // Second call because search grounding plus JSON output in one request is only in preview.
  const garments = await garmentJson(
    "Convert this shopping answer into the garment list. Use the price and product URL exactly as given; " +
      "set price_is_estimate to false when a price was found, true when you had to guess.\n\n" +
      (found.output_text ?? ""),
  );
  const refs = (await Promise.all(garments.map((g) => fetchProductImage(g.url)))).filter((r) => r !== null);
  return { garments, refs };
}

// shortcut: blocks obvious internal hosts only, not redirects or DNS tricks; add a proper egress allowlist before hosting this publicly.
function isPublicHttps(u: string) {
  try {
    const { protocol, hostname } = new URL(u);
    return protocol === "https:" && hostname.includes(".") && !/^[\d.]+$|^\[|\.local$|\.internal$/.test(hostname);
  } catch {
    return false;
  }
}

async function fetchProductImage(url?: string): Promise<Img | null> {
  try {
    if (!url || !isPublicHttps(url)) return null;
    const page = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { "user-agent": "Mozilla/5.0 GemiBot" } });
    const html = (await page.text()).slice(0, 400_000);
    const src =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1] ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1];
    if (!src) return null;
    const imgUrl = new URL(src.replaceAll("&amp;", "&"), page.url).href;
    if (!isPublicHttps(imgUrl)) return null;
    const res = await fetch(imgUrl, { signal: AbortSignal.timeout(6000) });
    const mime = res.headers.get("content-type")?.split(";")[0] ?? "";
    const bytes = Buffer.from(await res.arrayBuffer());
    if (!res.ok || !/^image\/(jpeg|png|webp)$/.test(mime) || bytes.length > 4_000_000) return null;
    return { mime, data: bytes.toString("base64") };
  } catch {
    return null; // the try-on falls back to the text description
  }
}

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

export async function generateTryOn(person: Img, garments: Garment[], refs: Img[], onlyCategories?: string[]): Promise<Img> {
  const scope = onlyCategories?.length
    ? `Change only these parts of the outfit: ${onlyCategories.join(", ")}. Keep every other piece of clothing they are wearing exactly as it is.`
    : "Replace their whole outfit.";
  return makeImage(
    "The first image is a photo of a person. Dress this exact person in the garments listed below. " +
      "Keep their face, hair, skin tone, body proportions, pose and background unchanged. " +
      `${scope}
Garments: ${describe(garments)}.
` +
      (refs.length
        ? "The remaining images are reference pictures of those garments; match them closely and ignore any person shown in them. "
        : "") +
      "Output one photorealistic full-body image.",
    [person, ...refs.slice(0, 8)],
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
