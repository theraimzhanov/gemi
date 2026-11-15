import { connection } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { jobViews } from "@/lib/job-views";
import { runDuePlans } from "@/lib/plans";
import { bad, fail } from "@/lib/validate";

// The user's recent requests and their results: this is the chat history.
export async function GET() {
  await connection(); // per-user data: never prerender this at build time
  try {
    const user = await currentUser();
    if (!user) return bad("Log in again to continue.", 401);
    // A second trigger for saved plans, for hosts where the server timer does not tick.
    void runDuePlans().catch(console.error);
    return Response.json(await jobViews(user.id));
  } catch (e) {
    return fail(e);
  }
}

// Clear chat: start a new conversation. Looks stay in My looks and saved plans stay saved.
export async function DELETE() {
  try {
    const user = await currentUser();
    if (!user) return bad("Log in again to continue.", 401);
    await db.query("UPDATE jobs SET hidden = true WHERE user_id = $1 AND NOT hidden", [user.id]);
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
