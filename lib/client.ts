// Browser-only helpers shared by the studio and feed pages.
import type { Garment, Img } from "./gemini";

export type Look = { id?: number; shared?: boolean; image: Img; garments: Garment[]; refs: Img[]; total_usd: number; intent?: { tool: string } };
export type FeedLook = {
  id: number; author: string; garments: Garment[]; total_usd: string | number; likes?: number; tryons?: number; shared?: boolean; liked?: boolean;
};

export const src = (i: Img) => `data:${i.mime};base64,${i.data}`;

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

// Downsize photos so uploads stay small and generation is faster.
export async function fileToImg(file: File, max = 1024): Promise<Img> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return { mime: "image/jpeg", data: canvas.toDataURL("image/jpeg", 0.85).split(",")[1] };
}

// The selfie stays in this browser; the server only sees it during a request.
export function loadSelfie(): Img | null {
  try {
    return JSON.parse(localStorage.getItem("gemi.selfie") ?? "null");
  } catch {
    return null;
  }
}
export function saveSelfie(i: Img) {
  try {
    localStorage.setItem("gemi.selfie", JSON.stringify(i));
  } catch {
    /* storage full or blocked: the selfie just won't be remembered */
  }
}

// Carries a try-on result from the feed page to the studio across client navigation.
let handoff: Look | null = null;
export const setHandoff = (look: Look) => { handoff = look; };
export function takeHandoff() {
  const look = handoff;
  handoff = null;
  return look;
}

export async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

// Starts a generation job and waits for it. The server answers at once with a job id; the result is read from
// the job row in Tiger Data, so a slow picture is never cut off by a request time limit.
export async function postJob<T>(url: string, body: unknown): Promise<T> {
  const { job } = await post<{ job: number }>(url, body);
  for (let tries = 0; tries < 90; tries++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(`/api/jobs/${job}`).catch(() => null);
    if (!res) continue; // a dropped connection: keep waiting, the job carries on without us
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Request failed");
    if (data.status === "done") return data.reply;
    if (data.status === "failed") throw new Error(data.error ?? "Something went wrong making that. Try again.");
  }
  throw new Error("That is taking longer than usual. Look in My looks in a minute; it will appear there when it is ready.");
}

// Browsers record webm/opus, which Gemini does not list as supported; re-encode to 16 kHz mono WAV.
export async function blobToWav(blob: Blob): Promise<Img> {
  const ctx = new AudioContext({ sampleRate: 16000 });
  const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
  await ctx.close();
  const pcm = audio.getChannelData(0);
  const view = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const str = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF"); view.setUint32(4, 36 + pcm.length * 2, true); str(8, "WAVEfmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  str(36, "data"); view.setUint32(40, pcm.length * 2, true);
  pcm.forEach((s, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true));
  return { mime: "audio/wav", data: await toBase64(new Blob([view])) };
}
