import { runDuePlans } from "@/lib/plans";
import { bad, fail } from "@/lib/validate";

export const maxDuration = 300;

// For the host's scheduler (see vercel.json). It only runs plans that are already due, so calling it is harmless;
// when CRON_SECRET is set, the caller must send it.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return bad("Not allowed", 401);
  try {
    return Response.json({ ran: await runDuePlans() });
  } catch (e) {
    return fail(e);
  }
}
