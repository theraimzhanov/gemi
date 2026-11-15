import type { Garment, Img } from "./gemini.ts";

export const MAX_PHOTOS = 13; // The person plus references fit the model's 14-image limit.
export const MAX_UPLOAD_B64 = 3_500_000;
export type Preferences = { gender: string; size: string; style: string };
export type Candidate = { garment: Garment; image?: Img };
export type Shopping = { request: string; budget?: number; categories: string[]; candidates: Candidate[] };

export function validPreferences(value: unknown): value is Preferences {
  if (!value || typeof value !== "object") return false;
  const p = value as Preferences;
  return [p.gender, p.size, p.style].every((v) => typeof v === "string" && v.length <= 200);
}

export function selectCandidates(shopping: Shopping, indices: unknown): Candidate[] {
  if (!Array.isArray(indices) || indices.length !== shopping.categories.length ||
      !indices.every((i) => Number.isInteger(i) && i >= 0 && i < shopping.candidates.length))
    throw new Error("Choose one item in every category.");
  const selected = indices.map((i: number) => shopping.candidates[i]);
  if (new Set(selected.map((c) => c.garment.category)).size !== shopping.categories.length ||
      !shopping.categories.every((category) => selected.some((c) => c.garment.category === category)))
    throw new Error("Choose one item in every category.");
  const cents = selected.reduce((sum, c) => sum + Math.round(c.garment.price_usd * 100), 0);
  if (shopping.budget !== undefined && cents > Math.round(shopping.budget * 100))
    throw new Error("These items exceed your budget. Choose lower-priced options.");
  return selected;
}

export function cheapestSelection(shopping: Shopping): number[] {
  return shopping.categories.map((category) => {
    let index = -1;
    shopping.candidates.forEach((c, i) => {
      if (c.garment.category === category && (index < 0 || c.garment.price_usd < shopping.candidates[index].garment.price_usd)) index = i;
    });
    return index;
  });
}
