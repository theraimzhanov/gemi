"use client";
import Link from "next/link";
import type { Garment } from "@/lib/gemini";
import { artSrc, lookArt } from "@/lib/art";
import { display } from "./styles";

export { btn, btnGhost, display, iconBtn } from "./styles";


const paths = {
  chat: "M4 5h16v11H9l-5 4V5Z",
  grid: "M4 4h7v9H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 15h7v5H4z",
  image: "M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15 9h.01",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0",
  plus: "M12 5v14M5 12h14",
  mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM5 11a7 7 0 0 0 14 0M12 18v3",
  stop: "M7 7h10v10H7z",
  send: "M12 19V5M5 12l7-7 7 7",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z",
  close: "M6 6l12 12M18 6 6 18",
  share: "M12 15V4M8 8l4-4 4 4M5 13v6h14v-6",
  check: "M5 12l5 5 9-10",
  logout: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h9",
};
export type IconName = keyof typeof paths;
export function Icon({ name, className = "size-5", fill = false }: { name: IconName; className?: string; fill?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className={`${display} flex items-center gap-2 text-2xl`}>
      <span className="grid size-8 place-items-center rounded-full bg-berry text-base text-white">g</span>
      gemi
    </Link>
  );
}

export const money = (n: number | string) => `$${Number(n).toFixed(Number(n) % 1 ? 2 : 0)}`;
export const Tag = ({ price }: { price: number | string }) => <span className="tag">{money(price)}</span>;

// One of Gemi's code-drawn illustrations, used wherever there is no generated photo yet.
export function Art({ garments, seed = 0, height = 460, className = "", alt = "" }: {
  garments: Pick<Garment, "category" | "description" | "color">[]; seed?: number; height?: number; className?: string; alt?: string;
}) {
  // eslint-disable-next-line @next/next/no-img-element -- inline SVG data URI
  return <img src={artSrc(lookArt(garments, seed, height))} alt={alt} width={300} height={height} className={`h-auto w-full ${className}`} />;
}

// The generated catalog photo of demo look `i` (see lib/demo.ts).
export function Photo({ i, className = "", alt = "" }: { i: number | string; className?: string; alt?: string }) {
  const file = typeof i === "number" ? String(i).padStart(2, "0") : i;
  // eslint-disable-next-line @next/next/no-img-element -- small pre-sized JPEGs in public/
  return <img src={`/looks/${file}.jpg`} alt={alt} width={600} height={800} loading="lazy" className={`h-auto w-full ${className}`} />;
}

export function Receipt({ garments, total }: { garments: Garment[]; total: number | string }) {
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Receipt</caption>
      <tbody>
        {garments.map((g, i) => (
          <tr key={i} className="border-b border-line">
            <td className="py-2.5 pr-3">
              {g.url ? (
                <a href={g.url} target="_blank" rel="noopener noreferrer" className="font-medium underline decoration-berry underline-offset-2 hover:text-berry">{g.description}</a>
              ) : (
                <span className="font-medium">{g.description}</span>
              )}
              <span className="block text-xs text-mute">{g.color} {g.category}{g.price_is_estimate && ", estimated price"}</span>
            </td>
            <td className="py-2.5 text-right align-top"><Tag price={g.price_usd} /></td>
          </tr>
        ))}
        <tr className={`${display} text-base`}>
          <td className="pt-3">Total</td>
          <td className="pt-3 text-right tabular-nums">{money(total)}</td>
        </tr>
      </tbody>
    </table>
  );
}

// A masonry card: picture, caption underneath, actions that appear over the picture.
export function LookCard({ image, author, total, badge, children }: {
  image: React.ReactNode; author?: string; total: number | string; badge?: string; children?: React.ReactNode;
}) {
  return (
    <article className="group">
      <div className="relative overflow-hidden rounded-3xl bg-mist">
        {image}
        {badge && <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold">{badge}</span>}
        {children && (
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-ink/60 to-transparent p-3 pt-12 opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
            {children}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 px-1 pt-2 text-sm">
        <span className="truncate font-medium">{author ?? " "}</span>
        <Tag price={total} />
      </div>
    </article>
  );
}

export const describeLook = (garments: Garment[]) => garments.map((g) => `${g.color} ${g.description}`).join(", ");
