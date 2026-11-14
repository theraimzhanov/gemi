"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Garment } from "@/lib/gemini";
import type { FeedLook } from "@/lib/client";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400";
export const btn = `rounded-full bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-400 disabled:opacity-40 ${focus}`;
export const btnGhost = `rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-white/10 disabled:opacity-40 aria-pressed:border-fuchsia-400 aria-pressed:text-fuchsia-300 ${focus}`;
export const iconBtn = `grid size-9 place-items-center rounded-full text-zinc-300 hover:bg-white/10 hover:text-white disabled:opacity-40 aria-pressed:bg-fuchsia-500 aria-pressed:text-white ${focus}`;
export const eyebrow = "text-xs font-medium uppercase tracking-[0.2em] text-zinc-400";

const paths = {
  plus: "M12 5v14M5 12h14",
  person: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0",
  mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM5 11a7 7 0 0 0 14 0M12 18v3",
  stop: "M7 7h10v10H7z",
  send: "M12 19V5M5 12l7-7 7 7",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z",
  close: "M6 6l12 12M18 6 6 18",
};
export function Icon({ name, className = "size-5" }: { name: keyof typeof paths; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

export type User = { id: string; username: string };
// undefined while loading, null when logged out.
export function useUser() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => setUser(d.user ?? null))
      .catch(() => setUser(null));
  }, []);
  return user;
}

export function Header() {
  const user = useUser();
  const logout = () => fetch("/api/auth", { method: "DELETE" }).finally(() => location.reload());
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-background/80 px-5 py-3 backdrop-blur">
      <Link href="/" className={`flex items-center gap-2 text-lg font-semibold tracking-tight ${focus}`}>
        <span className="grid size-6 place-items-center rounded-md bg-fuchsia-500 text-xs font-bold text-white">G</span>
        Gemi
      </Link>
      <nav className="flex gap-2">
        <Link href="/" className={btnGhost}>Studio</Link>
        <Link href="/feed" className={btnGhost}>Community</Link>
        {user && <button className={btnGhost} onClick={logout}>Log out<span className="hidden sm:inline"> · {user.username}</span></button>}
        {user === null && <Link href="/login" className={btn}>Log in</Link>}
      </nav>
    </header>
  );
}

export function Receipt({ garments, total }: { garments: Garment[]; total: number | string }) {
  return (
    <table className="w-full text-sm">
      <caption className={`pb-3 text-left ${eyebrow}`}>Receipt</caption>
      <tbody>
        {garments.map((g, i) => (
          <tr key={i} className="border-t border-white/10">
            <td className="py-2 pr-2">
              {g.url ? (
                <a href={g.url} target="_blank" rel="noopener noreferrer" className="underline decoration-fuchsia-400 underline-offset-2 hover:text-fuchsia-300">
                  {g.description}
                </a>
              ) : (
                g.description
              )}
              <span className="block text-xs text-zinc-400">{g.category} · {g.color}</span>
            </td>
            <td className="py-2 text-right whitespace-nowrap">
              ${Number(g.price_usd).toFixed(2)}
              {g.price_is_estimate && <span className="text-xs text-zinc-400"> est.</span>}
            </td>
          </tr>
        ))}
        <tr className="border-t border-white/30 font-semibold">
          <td className="py-2">Total</td>
          <td className="py-2 text-right">${Number(total).toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  );
}

export function LookCard({
  look, busy, onTry, onLike,
}: { look: FeedLook; busy: boolean; onTry: () => void; onLike?: () => void }) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      {/* eslint-disable-next-line @next/next/no-img-element -- served from our own DB route */}
      <img
        src={`/api/img/${look.id}`}
        alt={`Look by ${look.author}: ${look.garments.map((g) => g.description).join(", ")}`}
        className="aspect-[3/4] w-full object-cover"
        loading="lazy"
      />
      <div className="absolute inset-x-0 bottom-0 space-y-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 pt-10 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium">{look.author}</span>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">${Number(look.total_usd).toFixed(0)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button className={`${btn} flex-1 px-3 py-1.5`} disabled={busy} onClick={onTry}>Try on me</button>
          {onLike && (
            <button className={`${btnGhost} flex items-center gap-1 px-3 py-1.5`} onClick={onLike} aria-label={`Like this look, ${look.likes ?? 0} likes`}>
              <Icon name="heart" className="size-4" /> {look.likes ?? 0}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
