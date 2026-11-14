import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const kdf = promisify(scrypt) as (password: string, salt: Buffer, length: number) => Promise<Buffer>;

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${(await kdf(password, salt, 64)).toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false; // seeded demo accounts have no usable password
  const want = Buffer.from(hash, "hex");
  const got = await kdf(password, Buffer.from(salt, "hex"), 64);
  return want.length === got.length && timingSafeEqual(want, got);
}
