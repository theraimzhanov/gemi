import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { validPreferences } from "@/lib/styling";
import { bad, fail } from "@/lib/validate";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!validPreferences(body)) return bad("Keep each preference under 200 characters.");
  try {
    const user = await currentUser();
    if (!user) return bad("Log in to save your preferences.", 401);
    const preferences = { gender: body.gender.trim(), size: body.size.trim(), style: body.style.trim() };
    await db.query("UPDATE users SET preferences = $2 WHERE id = $1", [user.id, JSON.stringify(preferences)]);
    return Response.json({ preferences });
  } catch (e) { return fail(e); }
}
