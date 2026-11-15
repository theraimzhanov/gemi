import { BusyError, PictureCreditError, type Garment, type Img } from "./gemini";

// ~6 MB of base64 per file; the client downsizes photos well below this.
const MAX_B64 = 8_000_000;

export function isImg(x: unknown, kind: "image" | "audio" = "image"): x is Img {
  const i = x as Img;
  return (
    !!i && typeof i.mime === "string" && i.mime.startsWith(kind + "/") &&
    typeof i.data === "string" && i.data.length > 0 && i.data.length < MAX_B64
  );
}

export function isGarments(x: unknown): x is Garment[] {
  return (
    Array.isArray(x) && x.length > 0 && x.length <= 20 &&
    x.every((g) => g && typeof g.category === "string" && typeof g.description === "string" && typeof g.color === "string")
  );
}

// A problem the user can fix; its message is safe to show as written.
export class UserError extends Error {}

// The message a user may see for an error. Anything unexpected gets a generic line so internals never leak.
export function publicMessage(e: unknown): string {
  if (e instanceof UserError || e instanceof PictureCreditError || e instanceof BusyError) return e.message;
  if ((e as { status?: number })?.status === 503) return new BusyError().message;
  return "Something went wrong making that. Try again.";
}

export const bad = (message: string, status = 400) => Response.json({ error: message }, { status });

export function fail(e: unknown) {
  console.error(e);
  return bad(publicMessage(e), e instanceof UserError ? 400 : e instanceof PictureCreditError || e instanceof BusyError ? 503 : 500);
}
