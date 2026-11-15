// Shopping for one user, with everything Gemi knows about their taste. Used by the chat and by planned searches.
import { db } from "@/lib/db";
import { describe, shopGarments } from "@/lib/gemini";
import type { JobResult } from "@/lib/jobs";

export async function shopForUser(userId: string, request: string, budget: number | undefined, categories: string[]): Promise<JobResult> {
  const profile = await db.query("SELECT preferences FROM users WHERE id = $1", [userId]);
  // Looks the user shared are the style they chose to show as their own; looks they liked are taste too.
  const shared = await db.query("SELECT garments FROM looks WHERE user_id = $1 AND shared ORDER BY created_at DESC LIMIT 5", [userId]);
  const liked = await db.query(
    "SELECT l.garments FROM looks l WHERE l.shared AND EXISTS (SELECT 1 FROM look_events e WHERE e.look_id = l.id AND e.user_id = $1 AND e.kind = 'like') ORDER BY l.created_at DESC LIMIT 5", [userId]);
  const list = (rows: { garments: Parameters<typeof describe>[0] }[]) => rows.map((l) => describe(l.garments)).join(" / ") || "none yet";
  const preferences = `${JSON.stringify(profile.rows[0]?.preferences ?? {})}; The user's own style, from looks they shared: ${list(shared.rows)}; Looks by others they liked: ${list(liked.rows)}`;
  const shopping = await shopGarments(request, budget, categories, preferences);
  return {
    intent: { tool: "shop_and_dress", message: "Are these what you had in mind? Choose one item per category, then try them on. Prices exclude tax and shipping; check size and availability at the store." },
    shopping,
  };
}
