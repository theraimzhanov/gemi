import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { display } from "../../styles";
import { ProfileControls } from "./controls";

// Reads the login cookie and the user's own counts on every request.
export const instant = false;

export default async function Profile() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { rows } = await db.query(
    `SELECT count(*)::int AS looks, count(*) FILTER (WHERE shared)::int AS shared,
            (SELECT count(*)::int FROM look_events e JOIN looks l ON l.id = e.look_id
             WHERE l.user_id = $1 AND e.kind = 'like') AS likes
     FROM looks WHERE user_id = $1`,
    [user.id],
  );
  const stats: [string, number][] = [["Looks made", rows[0].looks], ["Shared", rows[0].shared], ["Likes received", rows[0].likes]];

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 md:py-14">
      <div className="flex items-center gap-5">
        <span className={`${display} grid size-20 shrink-0 place-items-center rounded-full bg-berry text-4xl uppercase text-white`}>{user.username[0]}</span>
        <div className="min-w-0">
          <h1 className={`${display} truncate text-5xl`}>{user.username}</h1>
          <p className="truncate text-mute">
            {user.email}, joined {user.created_at.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      <dl className="mt-8 grid grid-cols-3 gap-3">
        {stats.map(([label, n]) => (
          <div key={label} className="rounded-3xl bg-mist p-5">
            <dd className={`${display} text-4xl tabular-nums`}>{n}</dd>
            <dt className="mt-1 text-sm text-mute">{label}</dt>
          </div>
        ))}
      </dl>

      <ProfileControls />
    </main>
  );
}
