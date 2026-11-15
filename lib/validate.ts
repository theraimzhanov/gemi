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

export const bad = (message: string, status = 400) => Response.json({ error: message }, { status });

export function fail(e: unknown) {
  console.error(e);
  if (e instanceof PictureCreditError) return bad(e.message, 503);
  if (e instanceof BusyError || (e as { status?: number })?.status === 503) return bad(new BusyError().message, 503);
  return bad("Something went wrong generating that. Please try again.", 500);
}
