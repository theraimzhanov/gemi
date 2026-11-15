import { currentUser } from "@/lib/auth";
import { db, toVector } from "@/lib/db";
import { describe, editLook, embed, extractGarments, generateTryOn, routeIntent, shopGarments, totalUsd, transcribe, type Garment, type Img, type Intent } from "@/lib/gemini";
import { recentTurns } from "@/lib/job-views";
import { startJob } from "@/lib/jobs";
import { saveLook } from "@/lib/looks";
import { bad, fail, isImg, UserError } from "@/lib/validate";
import { MAX_PHOTOS, MAX_UPLOAD_B64, selectCandidates, type Shopping } from "@/lib/styling";

export const maxDuration = 300;

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return bad("Invalid request");
  const outfits: Img[] = b.outfits ?? (b.outfit ? [b.outfit] : []);
  if (!Array.isArray(outfits) || outfits.length > MAX_PHOTOS || !outfits.every((i) => isImg(i)))
    return bad(`Attach up to ${MAX_PHOTOS} JPG, PNG or WebP photos.`);
  if (b.selfie != null && !isImg(b.selfie)) return bad("Your photo is invalid. Please upload it again.");
  if (b.audio != null && !isImg(b.audio, "audio")) return bad("The voice recording is invalid. Please record it again.");
  const selfie: Img | undefined = b.selfie ?? undefined;
  const audio: Img | undefined = b.audio ?? undefined;
  if ([...outfits, selfie, audio].reduce((sum, i) => sum + (i?.data.length ?? 0), 0) > MAX_UPLOAD_B64)
    return bad("These attachments are too large together. Use fewer or smaller photos, or a shorter recording.");
  const text = typeof b.text === "string" ? b.text.trim().slice(0, 1000) : "";
  if (!outfits.length && !text && !audio && !b.selection) return bad("Add photos, type a request, or record one.");

  try {
    const user = await currentUser();
    if (!user) return bad("Log in to use the studio.", 401);
    let current: { image: Img; garments: Garment[] } | undefined;
    if (b.currentId != null) {
      if (!Number.isSafeInteger(b.currentId) || b.currentId < 1) return bad("Invalid current look.");
      const { rows } = await db.query("SELECT image, image_mime, garments FROM looks WHERE id = $1 AND user_id = $2", [b.currentId, user.id]);
      if (!rows[0]) return bad("That look is unavailable.", 404);
      current = { image: { mime: rows[0].image_mime, data: rows[0].image.toString("base64") }, garments: rows[0].garments };
    }

    // Only accept indices into this user's saved search; the browser cannot substitute prices or URLs.
    let confirmed: { shopping: Shopping; indices: number[] } | undefined;
    if (b.selection) {
      if (!Number.isSafeInteger(b.selection.job) || b.selection.job < 1) return bad("Invalid shopping search.");
      const { rows } = await db.query("SELECT result FROM jobs WHERE id = $1 AND user_id = $2 AND status = 'done' AND created_at > now() - interval '24 hours'", [b.selection.job, user.id]);
      const shopping = rows[0]?.result?.shopping as Shopping | undefined;
      if (!shopping) return bad("These choices expired. Search again for current prices.");
      try { selectCandidates(shopping, b.selection.indices); }
      catch (e) { return bad((e as Error).message); }
      confirmed = { shopping, indices: b.selection.indices };
      if (!selfie && !current) return bad("Add a photo of yourself first, using the person button.");
    }

    return await startJob(user, async (job) => {
      let said = text;
      if (audio && !confirmed) {
        const heard = await transcribe(audio);
        if (!heard) throw new UserError("I couldn't make out any words in that recording. Record it again a little closer to the microphone, or type your request.");
        said = [text, heard].filter(Boolean).join("\n");
        // Show the user what was heard, even if a later step fails.
        await db.query("UPDATE jobs SET request = request || $2::jsonb WHERE id = $1", [job, JSON.stringify({ text: said })]);
      }
      const intent: Intent = confirmed
        ? { tool: "shop_and_dress", request: confirmed.shopping.request, categories: confirmed.shopping.categories, budget_usd: confirmed.shopping.budget }
        : outfits.length && !text && !audio ? { tool: "steal_look" }
        : await routeIntent({ text: said, outfits, hasOutfitPhoto: !!outfits.length, hasCurrentLook: !!current,
            history: await recentTurns(user.id), wearing: current ? describe(current.garments) : "" });
      const look = async (image: Img, garments: Garment[], refs: Img[]) =>
        ({ intent, look_id: await saveLook(user, image, garments, refs) });

      if (confirmed) {
        const selected = selectCandidates(confirmed.shopping, confirmed.indices);
        const garments = selected.map((c) => c.garment);
        const refs = selected.flatMap((c) => c.image ? [c.image] : []);
        const base = current?.garments ?? [];
        const image = await generateTryOn(current?.image ?? selfie!, garments, refs, confirmed.shopping.categories, confirmed.shopping.request);
        // A dress takes the place of a top and bottom, and the other way round.
        const gone = new Set(confirmed.shopping.categories);
        if (gone.has("dress")) { gone.add("top"); gone.add("bottom"); }
        if (gone.has("top") || gone.has("bottom")) gone.add("dress");
        const receipt = [...base.filter((g) => !gone.has(g.category)), ...garments];
        // The rendered outfit is the authoritative reference for later community try-ons.
        return { ...await look(image, receipt, [image]), intent: { ...intent, message: `Your selected items total $${totalUsd(garments).toFixed(2)} before tax and shipping.${base.length ? " The receipt also includes the clothes kept from your previous look." : ""}` } };
      }

      switch (intent.tool) {
        case "steal_look": {
          if (!selfie && !current) throw new UserError("Add a photo of yourself first, using the person button.");
          if (!outfits.length) throw new UserError("Attach the product or outfit photos you want to try.");
          const instruction = [said, intent.instruction].filter(Boolean).join("\n");
          const garments = await extractGarments(outfits, instruction);
          const image = await generateTryOn(current?.image ?? selfie!, garments, outfits, [...new Set(garments.map((g) => g.category))], instruction);
          return look(image, await extractGarments(image), [image]);
        }
        case "shop_and_dress": {
          if (intent.budget_usd !== undefined && (!Number.isFinite(intent.budget_usd) || intent.budget_usd <= 0))
            throw new UserError("Use a positive budget in USD.");
          const profile = await db.query("SELECT preferences FROM users WHERE id = $1", [user.id]);
          const liked = await db.query(
            "SELECT l.garments FROM looks l WHERE l.shared AND EXISTS (SELECT 1 FROM look_events e WHERE e.look_id = l.id AND e.user_id = $1 AND e.kind = 'like') ORDER BY l.created_at DESC LIMIT 5", [user.id]);
          const preferences = JSON.stringify(profile.rows[0].preferences) + "; Examples of liked styles: " + liked.rows.map((l) => describe(l.garments)).join(" / ");
          const shopping = await shopGarments(intent.request, intent.budget_usd, intent.categories, preferences);
          return { intent: { ...intent, message: "Are these what you had in mind? Choose one item per category, then try them on. Prices exclude tax and shipping; check size and availability at the store." }, shopping };
        }
        case "micro_edit": {
          if (!current) throw new UserError("Make a look first, then ask for a change.");
          const image = await editLook(current.image, intent.instruction);
          return look(image, await extractGarments(image), [image]);
        }
        case "find_similar": {
          const { rows } = await db.query(
            `SELECT id, author, garments, total_usd FROM looks
             WHERE shared AND embedding IS NOT NULL ORDER BY embedding <=> $1::vector LIMIT 6`,
            [toVector(await embed(intent.query))],
          );
          return { intent, similar: rows };
        }
        default: return { intent };
      }
    }, confirmed ? { text: "Try these selected items on me" } : { text, photos: outfits.length, voice: !!audio });
  } catch (e) { return fail(e); }
}
