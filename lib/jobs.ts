import { after } from "next/server";
import type { User } from "./auth";
import { db } from "./db";
import { publicMessage } from "./validate";
import { reserveJob } from "./job-limit";
import type { Shopping } from "./styling";

// What a finished job stores. Pictures stay in the looks table; the job only points at them.
export type JobResult = { intent: { tool: string; message?: string }; look_id?: number; similar?: unknown[]; shopping?: Shopping };

// Records the request in Tiger Data, answers at once with the job id, and does the slow work after the response.
export async function startJob(user: User, work: () => Promise<JobResult>) {
  const id = await reserveJob(user.id);
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
