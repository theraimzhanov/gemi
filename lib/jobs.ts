import { after } from "next/server";
import type { User } from "./auth";
import { db } from "./db";
import { publicMessage } from "./validate";

// What a finished job stores. Pictures stay in the looks table; the job only points at them.
export type JobResult = { intent: { tool: string; message?: string }; look_id?: number; similar?: unknown[] };

// Records the request in Tiger Data, answers at once with the job id, and does the slow work after the response.
export async function startJob(user: User, work: () => Promise<JobResult>) {
  const { rows } = await db.query("INSERT INTO jobs (user_id) VALUES ($1) RETURNING id", [user.id]);
  const id = rows[0].id;
  after(async () => {
    try {
      const result = await work();
      await db.query("UPDATE jobs SET status = 'done', result = $2, finished_at = now() WHERE id = $1", [id, JSON.stringify(result)]);
    } catch (e) {
      console.error(e);
      // If this update fails too, the job stays 'working' and the status route reports it as timed out.
      await db.query("UPDATE jobs SET status = 'failed', error = $2, finished_at = now() WHERE id = $1", [id, publicMessage(e)]).catch(() => {});
    }
  });
  return Response.json({ job: Number(id) }, { status: 202 });
}
