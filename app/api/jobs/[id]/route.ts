import { currentUser } from "@/lib/auth";
import { jobViews } from "@/lib/job-views";
import { bad, fail } from "@/lib/validate";

// The chat asks this every couple of seconds while a job is working.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return bad("Unknown job", 404);
  try {
    const user = await currentUser();
    if (!user) return bad("Log in again to continue.", 401);
    const [job] = await jobViews(user.id, id);
    return job ? Response.json(job) : bad("Unknown job", 404);
  } catch (e) {
    return fail(e);
  }
}
