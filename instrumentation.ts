// Runs once when the server starts: every minute, do the saved plans whose date has come.
// shortcut: this timer needs a server that stays running (next dev, next start). On serverless hosting it does
// not tick, so /api/cron does the same work when the host's scheduler calls it.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { runDuePlans } = await import("@/lib/plans");
  setInterval(() => { runDuePlans().catch(console.error); }, 60_000).unref();
}
