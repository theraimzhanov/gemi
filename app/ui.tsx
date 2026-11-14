"use client";
import Link from "next/link";
import type { Garment } from "@/lib/gemini";
import type { FeedLook } from "@/lib/client";

export const btn =
  "rounded-full bg-fuchsia-600 px-4 py-2 text-sm font-medium text-white hover:bg-fuchsia-700 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-600";
export const btnGhost =
  "rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <Link href="/" className="text-xl font-bold tracking-tight text-fuchsia-600">Gemi</Link>
      <nav className="flex gap-4 text-sm font-medium">
        <Link href="/" className="hover:underline">Studio</Link>
        <Link href="/feed" className="hover:underline">Community</Link>
      </nav>
    </header>
  );
}

export function Receipt({ garments, total }: { garments: Garment[]; total: number | string }) {
  return (
    <table className="w-full text-sm">
      <caption className="pb-2 text-left font-semibold">Receipt</caption>
      <tbody>
        {garments.map((g, i) => (
          <tr key={i} className="border-t border-zinc-200 dark:border-zinc-800">
            <td className="py-1.5 pr-2">
              {g.url ? (
                <a href={g.url} target="_blank" rel="noopener noreferrer" className="underline">{g.description}</a>
              ) : (
                g.description
              )}
              <span className="block text-xs text-zinc-500">{g.category} · {g.color}</span>
            </td>
            <td className="py-1.5 text-right whitespace-nowrap">
              ${Number(g.price_usd).toFixed(2)}
              {g.price_is_estimate && <span className="text-xs text-zinc-500"> est.</span>}
            </td>
          </tr>
        ))}
        <tr className="border-t-2 border-zinc-400 font-semibold">
          <td className="py-1.5">Total</td>
          <td className="py-1.5 text-right">${Number(total).toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  );
}

export function LookCard({
  look, busy, onTry, onLike,
}: { look: FeedLook; busy: boolean; onTry: () => void; onLike?: () => void }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
      {/* eslint-disable-next-line @next/next/no-img-element -- served from our own DB route */}
      <img
        src={`/api/img/${look.id}`}
        alt={`Look by ${look.author}: ${look.garments.map((g) => g.description).join(", ")}`}
        className="aspect-[3/4] w-full object-cover"
        loading="lazy"
      />
      <div className="space-y-2 p-3 text-sm">
        <div className="flex justify-between">
          <span className="font-medium">{look.author}</span>
          <span>${Number(look.total_usd).toFixed(2)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={btn} disabled={busy} onClick={onTry}>Try this look on me</button>
          {onLike && (
            <button className={btnGhost} onClick={onLike} aria-label={`Like this look, ${look.likes ?? 0} likes`}>
              ♥ {look.likes ?? 0}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
