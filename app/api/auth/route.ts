import { db } from "@/lib/db";
import { createSession, currentUser, destroySession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { bad, fail } from "@/lib/validate";

export async function GET() {
  try {
    return Response.json({ user: await currentUser() });
  } catch (e) {
    return fail(e);
  }
}

// shortcut: no limit on login attempts; add per-IP throttling before a public launch.
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const username = typeof b?.username === "string" ? b.username.trim().toLowerCase() : "";
  const password = typeof b?.password === "string" ? b.password : "";
  try {
    if (b?.mode === "register") {
      if (!/^[a-z0-9_]{3,20}$/.test(username)) return bad("Username must be 3–20 letters, numbers or underscores.");
      if (password.length < 8 || password.length > 200) return bad("Password must be at least 8 characters.");
      const r = await db.query(
        "INSERT INTO users (username, password_hash) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING RETURNING id",
        [username, await hashPassword(password)],
      );
      if (!r.rowCount) return bad("That username is taken.", 409);
      await createSession(r.rows[0].id);
      return Response.json({ user: { id: r.rows[0].id, username } });
    }
    const r = await db.query("SELECT id, password_hash FROM users WHERE username = $1", [username]);
    if (!r.rowCount || !(await verifyPassword(password, r.rows[0].password_hash)))
      return bad("Wrong username or password.", 401);
    await createSession(r.rows[0].id);
    return Response.json({ user: { id: r.rows[0].id, username } });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE() {
  try {
    await destroySession();
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
