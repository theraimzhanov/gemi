import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { BlockList } from "node:net";
import sharp from "sharp";
import type { Img } from "./gemini.ts";

const blocked = new BlockList();
for (const [ip, prefix] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 3]] as const) blocked.addSubnet(ip, prefix);

export function publicProductUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2000) return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password && (!u.port || u.port === "443") &&
      u.hostname.includes(".") && !/^[\d.]+$|:|\.local$|\.internal$/.test(u.hostname);
  } catch { return false; }
}

async function download(value: string, maxBytes: number, prefixOnly = false, redirects = 0): Promise<{ bytes: Buffer; mime: string; url: string }> {
  if (!publicProductUrl(value) || redirects > 3) throw new Error("Unsupported product URL");
  // Pin a verified public IPv4 address for this request; revalidate every redirect.
  const addresses = await lookup(new URL(value).hostname, { family: 4, all: true });
  if (!addresses.length || addresses.some((a) => blocked.check(a.address))) throw new Error("Private product host");
  const result = await new Promise<{ bytes: Buffer; mime: string; redirect?: string }>((resolve, reject) => {
    const req = request(value, {
      headers: { "user-agent": "Mozilla/5.0 GemiBot" },
      signal: AbortSignal.timeout(6000),
      lookup: (_host, options, callback) => {
        if (options.all) callback(null, [addresses[0]]);
        else callback(null, addresses[0].address, 4);
      },
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume(); resolve({ bytes: Buffer.alloc(0), mime: "", redirect: res.headers.location }); return;
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error("Product unavailable")); return; }
      const chunks: Buffer[] = [];
      let length = 0;
      const finish = () => resolve({ bytes: Buffer.concat(chunks), mime: res.headers["content-type"]?.split(";")[0] ?? "" });
      res.on("data", (chunk: Buffer) => {
        if (length + chunk.length > maxBytes) {
          if (prefixOnly) { chunks.push(chunk.subarray(0, maxBytes - length)); finish(); req.destroy(); }
          else req.destroy(new Error("Product response too large"));
        } else { chunks.push(chunk); length += chunk.length; }
      });
      res.on("error", reject);
      res.on("end", finish);
    });
    req.on("error", reject); req.end();
  });
  return result.redirect ? download(new URL(result.redirect, value).href, maxBytes, prefixOnly, redirects + 1) : { ...result, url: value };
}

export async function fetchProductImage(url?: string): Promise<Img | null> {
  try {
    if (!url) return null;
    const page = await download(url, 400_000, true);
    const html = page.bytes.toString("utf8");
    const source = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1] ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1];
    if (!source) return null;
    const image = await download(new URL(source.replaceAll("&amp;", "&"), page.url).href, 4_000_000);
    if (!/^image\/(jpeg|png|webp)$/.test(image.mime)) return null;
    const preview = await sharp(image.bytes, { limitInputPixels: 40_000_000 }).rotate()
      .resize(512, 512, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 75 }).timeout({ seconds: 3 }).toBuffer();
    if (preview.length > 150_000) return null;
    return { mime: "image/jpeg", data: preview.toString("base64") };
  } catch { return null; }
}
