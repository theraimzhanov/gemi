// Saved plans: a shopping search the user asked for now, to be run by Gemi on a later date without the user present.
import { db } from "@/lib/db";
import { reserveJob } from "@/lib/job-limit";
import { shopForUser } from "@/lib/shop";
import { publicMessage, UserError } from "@/lib/validate";

// shortcut: dates are shown in the server's time zone, store the user's zone before serving several regions.
const when = (d: Date) => d.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });

export async function savePlan(userId: string, p: { request: string; budget_usd?: number; categories: string[]; run_at: string; note?: string }): Promise<string> {
  const at = new Date(p.run_at);
  const request = p.request.trim().replace(/\.$/, "").slice(0, 500);
  if (!request) throw new UserError("What should I look for when the time comes?");
  if (Number.isNaN(at.getTime())) throw new UserError("When should I do that? Give me a date, like “on December 1” or “in two weeks”.");
  if (at.getTime() < Date.now() - 60_000) throw new UserError("That date has already passed. Tell me a date in the future.");
  if (at.getTime() > Date.now() + 366 * 86_400_000) throw new UserError("I can plan up to one year ahead. Tell me a nearer date.");
  if (p.budget_usd !== undefined && (!Number.isFinite(p.budget_usd) || p.budget_usd <= 0)) throw new UserError("Use a positive budget in USD.");
  const open = await db.query("SELECT count(*)::int AS n FROM plans WHERE user_id = $1 AND status = 'waiting'", [userId]);
  if (open.rows[0].n >= 10) throw new UserError("You already have 10 saved plans. Ask me to cancel them before adding more.");
  await db.query(
    "INSERT INTO plans (user_id, request, budget_usd, categories, note, run_at) VALUES ($1, $2, $3, $4, $5, $6)",
    [userId, request, p.budget_usd ?? null, JSON.stringify(p.categories), (p.note ?? "").slice(0, 200), at],
  );
  return `Saved${p.note ? ` for ${p.note}` : ""}. I have not started yet: I will search for “${request}” on ${when(at)}, and the choices will be waiting here in Chat even if you are away. Ask me any time how it is going.`;
}

export async function planStatus(userId: string): Promise<string> {
  const { rows } = await db.query(
    "SELECT request, note, run_at, status FROM plans WHERE user_id = $1 AND status <> 'cancelled' ORDER BY run_at DESC LIMIT 10", [userId]);
  if (!rows.length) return "You have no saved plans. Tell me what you need and when, like “find me a suit a week before my interview on December 10”.";
  return rows.reverse().map((p) => {
    const what = `“${p.request}”${p.note ? ` for ${p.note}` : ""}`;
    return p.status === "waiting" ? `I have not started yet: ${what} is planned for ${when(p.run_at)}.`
      : p.status === "running" ? `I am searching right now: ${what}.`
      : p.status === "done" ? `Done on ${when(p.run_at)}: ${what}. The choices are in this chat.`
      : `I tried ${what} on ${when(p.run_at)} and it did not work. The reason is in this chat.`;
  }).join("\n");
}

export async function cancelPlans(userId: string): Promise<string> {
  const { rowCount } = await db.query("UPDATE plans SET status = 'cancelled' WHERE user_id = $1 AND status = 'waiting'", [userId]);
  return rowCount ? `Cancelled ${rowCount} saved ${rowCount === 1 ? "plan" : "plans"}. Nothing will be searched.` : "There was nothing to cancel: no plan is waiting.";
}

// Runs every plan whose date has come. Safe to call often and from several places: each plan is claimed by one caller.
export async function runDuePlans() {
  const { rows } = await db.query(
    `UPDATE plans SET status = 'running', claimed_at = now() WHERE id IN (
       SELECT id FROM plans
       WHERE (status = 'waiting' AND run_at <= now()) OR (status = 'running' AND claimed_at < now() - interval '15 minutes')
       ORDER BY run_at LIMIT 3 FOR UPDATE SKIP LOCKED)
     RETURNING id, user_id, request, budget_usd, categories, note`);
  for (const p of rows) {
    let job: number | undefined;
    try {
      // The result is an ordinary chat row, so the user finds it in Chat when they come back.
      job = await reserveJob(p.user_id, { text: `Planned search${p.note ? ` for ${p.note}` : ""}: ${p.request}`, planned: true });
      const result = await shopForUser(p.user_id, p.request, p.budget_usd == null ? undefined : Number(p.budget_usd), p.categories);
      await db.query("UPDATE jobs SET status = 'done', result = $2, finished_at = now() WHERE id = $1", [job, JSON.stringify(result)]);
      await db.query("UPDATE plans SET status = 'done', job_id = $2 WHERE id = $1", [p.id, job]);
    } catch (e) {
      console.error(e);
      if (job === undefined) {
        // The daily request cap was reached before starting: try again in an hour.
        await db.query("UPDATE plans SET status = 'waiting', run_at = now() + interval '1 hour' WHERE id = $1", [p.id]).catch(() => {});
        continue;
      }
      await db.query("UPDATE jobs SET status = 'failed', error = $2, finished_at = now() WHERE id = $1", [job, publicMessage(e)]).catch(() => {});
      await db.query("UPDATE plans SET status = 'failed', job_id = $2 WHERE id = $1", [p.id, job]).catch(() => {});
    }
  }
  return rows.length;
}
