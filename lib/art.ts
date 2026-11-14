// Code-drawn fashion illustrations: a stand-in for generated photos until the image model is available.
import type { Garment } from "./gemini";

type Piece = Pick<Garment, "category" | "description" | "color">;

const COLORS: Record<string, string> = {
  red: "#c8323c", tan: "#c9a27a", black: "#232026", "light blue": "#a9c8e8", white: "#f4f1ea", olive: "#6b7044",
  beige: "#d9c7a8", ivory: "#f1e9d8", "sky blue": "#8fc1ea", cream: "#ece2cc", navy: "#26345c", tortoiseshell: "#7a4a2a",
  silver: "#c3c7cf", "forest green": "#2f5d43", indigo: "#34407a", grey: "#b3b6bd", natural: "#d8c6a0",
  "sage green": "#a3b59a", brown: "#6e4a34", charcoal: "#3b3d44", "neon yellow": "#d9f03c", blue: "#3f6fd1",
  pink: "#e79ab5", green: "#3f8a5a", yellow: "#e8c23a", orange: "#e07a2f", purple: "#7a4fb5",
};
const NAMES = Object.keys(COLORS).sort((a, b) => b.length - a.length);
const SKIN = ["#e8b896", "#c68e6a", "#8d5a3c", "#f0cdb0", "#a9714b"];
const HAIR = ["#2a1d17", "#5a3620", "#111014", "#b8793a", "#3a2a22"];

function hex(name: string) {
  const n = name.toLowerCase();
  const hit = NAMES.find((k) => n.includes(k));
  if (hit) return COLORS[hit];
  let h = 0;
  for (const c of n) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 45% 55%)`;
}

// Blend a hex colour toward white; t = 1 is white.
function tint(color: string, t: number) {
  if (!color.startsWith("#")) return color;
  const n = parseInt(color.slice(1), 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) * (1 - t) + 255 * t);
  return `rgb(${ch(16)} ${ch(8)} ${ch(0)})`;
}

export function lookArt(garments: Piece[], seed = 0, height = 460): string {
  const piece = (c: string) => garments.find((g) => g.category === c);
  const color = (c: string) => { const p = piece(c); return p && hex(p.color); };
  const has = (c: string, word: string) => !!piece(c)?.description.toLowerCase().includes(word);

  const dress = color("dress"), top = color("top"), bottom = color("bottom"), outer = color("outerwear");
  const shoes = color("shoes") ?? "#2b2830", acc = color("accessory");
  let main = dress ?? outer ?? top ?? "#b98aa8";
  if (main === COLORS.white || main === COLORS.ivory || main === COLORS.cream) main = bottom ?? "#b9a7c9";
  const skin = SKIN[seed % SKIN.length], hair = HAIR[(seed * 3 + 1) % HAIR.length];
  const longHair = seed % 2 === 0;
  const s = height / 500;

  const legEnd = has("bottom", "short") ? 300 : 428;
  const sleeve = outer ?? (dress ? null : top);
  const sleeveEnd = outer ? 238 : 182;
  const jacketEnd = has("outerwear", "cropped") ? 236 : 292;

  const body = [
    `<path d="M60 500V196a90 90 0 0 1 180 0v304z" fill="${tint(main, 0.55)}"/>`,
    `<ellipse cx="150" cy="452" rx="78" ry="9" fill="#000" opacity=".13"/>`,
    longHair ? `<path d="M123 78q-6 52 8 74h38q14-22 8-74z" fill="${hair}"/>` : "",
    // legs and shoes
    `<path d="M117 236h33l-3 196h-24zM150 236h33l-6 196h-24z" fill="${skin}"/>`,
    `<path d="M112 446q0-12 16-12h17q5 0 5 6v6zM150 446v-6q0-6 5-6h17q16 0 16 12z" fill="${shoes}"/>`,
    bottom && !dress
      ? has("bottom", "skirt")
        ? `<path d="M115 232h70l18 100q-53 12-106 0z" fill="${bottom}"/>`
        : `<path d="M114 232h72l-7 ${legEnd - 232}h-25l-4-${legEnd - 262}-4 ${legEnd - 262}h-25z" fill="${bottom}"/>`
      : "",
    // arms, then sleeves over them
    `<path d="M110 130L92 250M190 130l18 120" stroke="${skin}" stroke-width="15" stroke-linecap="round" fill="none"/>`,
    sleeve
      ? `<path d="M110 130L${110 - (sleeveEnd - 130) * 0.15} ${sleeveEnd}M190 130l${(sleeveEnd - 130) * 0.15} ${sleeveEnd - 130}" stroke="${sleeve}" stroke-width="18" stroke-linecap="round" fill="none"/>`
      : "",
    `<rect x="143" y="96" width="14" height="30" rx="5" fill="${skin}"/>`,
    dress
      ? `<path d="M117 120q33 15 66 0l-2 112 33 152q-64 14-128 0l33-152z" fill="${dress}"/>`
      : `<path d="M111 120q39 15 78 0l-3 122h-72z" fill="${top ?? "#f4f1ea"}"/>`,
    outer
      ? `<path d="M104 120l34 4-9 ${jacketEnd - 120}h-29zM196 120l-34 4 9 ${jacketEnd - 120}h29z" fill="${outer}"/>` +
        `<path d="M138 124l-9 ${jacketEnd - 120}M162 124l9 ${jacketEnd - 120}" stroke="#000" stroke-opacity=".18" stroke-width="1.5"/>`
      : "",
    // head
    `<circle cx="150" cy="76" r="25" fill="${skin}"/>`,
    `<path d="M124 78a26 26 0 0 1 52 0q-6-17-26-17t-26 17z" fill="${hair}"/>`,
    acc && has("accessory", "hat")
      ? `<ellipse cx="150" cy="58" rx="44" ry="8" fill="${acc}"/><path d="M128 58a22 20 0 0 1 44 0z" fill="${acc}"/>`
      : acc && has("accessory", "glasses")
        ? `<path d="M134 74h13v8h-13zM153 74h13v8h-13zM147 77h6" fill="${acc}" stroke="${acc}" stroke-width="2"/>`
        : acc
          ? `<path d="M188 126l26 134" stroke="${acc}" stroke-width="3"/><rect x="198" y="256" width="36" height="30" rx="7" fill="${acc}"/>`
          : "",
  ].join("");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="${height}" viewBox="0 0 300 ${height}">` +
    `<defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${tint(main, 0.86)}"/><stop offset="1" stop-color="${tint(main, 0.7)}"/></linearGradient></defs>` +
    `<rect width="300" height="${height}" fill="url(#b)"/>` +
    `<g transform="translate(${150 - 150 * s} 0) scale(${s})">${body}</g></svg>`
  );
}

export const artSrc = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
