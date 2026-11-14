import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { Shell } from "./shell";

// Every request reads the login cookie, so this route renders on the server instead of from a static shell.
export const instant = false;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <Shell me={{ id: user.id, username: user.username }}>{children}</Shell>;
}
