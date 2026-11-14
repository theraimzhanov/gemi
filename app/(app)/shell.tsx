"use client";
import { createContext, useContext } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, Logo, type IconName } from "../ui";

export type Me = { id: string; username: string };
const MeContext = createContext<Me | null>(null);
export const useMe = () => useContext(MeContext)!;

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/studio", label: "Chat", icon: "chat" },
  { href: "/feed", label: "Community", icon: "grid" },
  { href: "/looks", label: "My looks", icon: "image" },
  { href: "/profile", label: "Profile", icon: "user" },
];

export function Shell({ me, children }: { me: Me; children: React.ReactNode }) {
  const path = usePathname();
  return (
    <MeContext.Provider value={me}>
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-white p-4 md:flex">
        <div className="px-2 py-2"><Logo href="/studio" /></div>
        <nav className="mt-6 flex flex-col gap-1" aria-label="Main">
          {NAV.map((n) => {
            const active = path.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-full px-4 py-3 text-[15px] font-semibold transition-colors ${active ? "bg-ink text-white" : "hover:bg-mist"}`}>
                <Icon name={n.icon} /> {n.label}
              </Link>
            );
          })}
        </nav>
        <Link href="/profile" className="mt-auto flex items-center gap-3 rounded-full p-2 hover:bg-mist">
          <span className="grid size-9 place-items-center rounded-full bg-berry font-display font-semibold uppercase text-white">{me.username[0]}</span>
          <span className="truncate text-sm font-semibold">{me.username}</span>
        </Link>
      </aside>

      <div className="flex min-h-dvh flex-col pb-16 md:pb-0 md:pl-60">{children}</div>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-white md:hidden" aria-label="Main">
        {NAV.map((n) => {
          const active = path.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${active ? "text-berry" : "text-mute"}`}>
              <Icon name={n.icon} /> {n.label}
            </Link>
          );
        })}
      </nav>
    </MeContext.Provider>
  );
}
