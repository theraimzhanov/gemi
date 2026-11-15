// Read-only views of the jobs table: the chat history and what the router is told about it.
import { db } from "./db";

// One job, or the user's latest 20 oldest first, in the shape the chat screen shows. Pictures are loaded by look id.
export async function jobViews(userId: string, id?: number) {
  const { rows } = await db.query(
    `SELECT j.id, j.status, j.result, j.error, j.request, j.created_at < now() - interval '6 minutes' AS stale,
            l.id AS look_id, l.garments, l.total_usd, l.shared
     FROM jobs j LEFT JOIN looks l ON l.id = (j.result->>'look_id')::bigint AND l.user_id = j.user_id
     WHERE j.user_id = $1 AND NOT j.hidden ${id ? "AND j.id = $2" : ""} ORDER BY j.id DESC LIMIT 20`,
    id ? [userId, id] : [userId],
  );
  return rows.reverse().map((r) => {
    // A job still 'working' after six minutes was interrupted, for example by a server restart.
    const dead = r.status === "working" && r.stale;
    const { intent, similar, shopping } = r.result ?? {};
    return {
      id: Number(r.id),
      status: dead ? "failed" : r.status,
      error: dead ? "That took too long and was stopped. Please send it again." : r.error ?? undefined,
      request: r.request,
      reply: r.status !== "done" ? undefined : {
        intent: r.result.look_id && !r.look_id ? { tool: "none", message: "This look was deleted." } : intent,
        similar,
        shopping: shopping ? { ...shopping, job: Number(r.id) } : undefined,
        look: r.look_id ? { id: Number(r.look_id), shared: r.shared, garments: r.garments, total_usd: Number(r.total_usd) } : undefined,
      },
    };
  });
}

// The last few finished turns as plain text, so a follow-up like "cheaper" or "in black" can be understood.
export async function recentTurns(userId: string): Promise<string> {
  const { rows } = await db.query(
    "SELECT request, result, error FROM jobs WHERE user_id = $1 AND status <> 'working' AND NOT hidden ORDER BY id DESC LIMIT 6", [userId]);
  return rows.reverse().map((r) =>
    `User: ${r.request?.text || (r.request?.photos ? "(sent photos)" : "(no text)")}\n` +
    `Gemi: ${r.error ?? JSON.stringify(r.result?.intent ?? {}).slice(0, 300)}`).join("\n");
}
