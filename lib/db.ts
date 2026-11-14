import { Pool } from "pg";

// Reuse one pool across dev hot reloads.
const g = globalThis as { gemiPool?: Pool };
export const db = (g.gemiPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }));

export const toVector = (v: number[]) => `[${v.join(",")}]`;
