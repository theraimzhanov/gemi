import { Pool, type PoolConfig } from "pg";
import { TIMESCALE_CA } from "./timescale-ca.ts";

export function pgConfig(): PoolConfig {
  // sslmode in the URL would override the ssl option below, so drop it and verify against Timescale's CA instead.
  const url = new URL(process.env.DATABASE_URL ?? "");
  url.searchParams.delete("sslmode");
  return { connectionString: url.href, ssl: { ca: TIMESCALE_CA }, connectionTimeoutMillis: 15000, max: 5 };
}

// Reuse one pool across dev hot reloads.
const g = globalThis as { gemiPool?: Pool };
export const db = (g.gemiPool ??= new Pool(pgConfig()));

export const toVector = (v: number[]) => `[${v.join(",")}]`;
