import { db } from "./db.ts";
import { RateLimitError } from "./validate.ts";

export async function reserveJob(userId: string, request: object = {}): Promise<number> {
  const limit = Number(process.env.DAILY_JOB_LIMIT ?? 40);
  if (!Number.isInteger(limit) || limit < 1) throw new Error("Invalid DAILY_JOB_LIMIT");
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    // Serialize reservations for this user so simultaneous requests cannot bypass the cap.
    await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [userId]);
    const count = await client.query("SELECT count(*)::int AS n FROM jobs WHERE user_id = $1 AND created_at > now() - interval '24 hours'", [userId]);
    if (count.rows[0].n >= limit) throw new RateLimitError(`You've used your ${limit} styling requests for the last 24 hours. Please try again later.`);
    const { rows } = await client.query("INSERT INTO jobs (user_id, request) VALUES ($1, $2) RETURNING id", [userId, JSON.stringify(request)]);
    await client.query("COMMIT");
    return Number(rows[0].id);
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally { client.release(); }
}
