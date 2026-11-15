import { BusyError, PictureCreditError, ShoppingError, type Img } from "./gemini.ts";

// ~6 MB of base64 per file; the client downsizes photos well below this.
const MAX_B64 = 8_000_000;

export function isImg(x: unknown, kind: "image" | "audio" = "image"): x is Img {
  const i = x as Img;
  return (
    !!i && typeof i.mime === "string" && (kind === "image" ? /^image\/(jpeg|png|webp)$/.test(i.mime) : i.mime === "audio/wav") &&
    typeof i.data === "string" && i.data.length > 0 && i.data.length < MAX_B64 && /^[A-Za-z0-9+/]+={0,2}$/.test(i.data)
  );
}

// A problem the user can fix; its message is safe to show as written.
export class UserError extends Error {}
export class RateLimitError extends UserError {}

// The message a user may see for an error. Anything unexpected gets a generic line so internals never leak.
export function publicMessage(e: unknown): string {
  if (e instanceof UserError || e instanceof PictureCreditError || e instanceof BusyError || e instanceof ShoppingError) return e.message;
  if ([429, 503].includes((e as { status?: number })?.status ?? 0)) return new BusyError().message;
  return "Something went wrong making that. Try again.";
}

export const bad = (message: string, status = 400) => Response.json({ error: message }, { status });

export function fail(e: unknown) {
  console.error(e);
  return bad(publicMessage(e), e instanceof RateLimitError ? 429 : e instanceof UserError ? 400 : e instanceof PictureCreditError || e instanceof BusyError ? 503 : 500);
}
