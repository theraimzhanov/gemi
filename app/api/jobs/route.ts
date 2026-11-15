import { currentUser } from "@/lib/auth";
import { jobViews } from "@/lib/job-views";
import { bad, fail } from "@/lib/validate";

// The user's recent requests and their results: this is the chat history.
export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return bad("Log in again to continue.", 401);
    return Response.json(await jobViews(user.id));
  } catch (e) {
    return fail(e);
  }
}
