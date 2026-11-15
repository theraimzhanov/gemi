import { currentUser } from "@/lib/auth";
import { db, toVector } from "@/lib/db";
import {
  editLook, embed, extractGarments, generateTryOn, routeIntent, shopGarments,
  type Garment, type Img, type Intent,
} from "@/lib/gemini";
import { startJob } from "@/lib/jobs";
import { saveLook } from "@/lib/looks";
import { bad, fail, isGarments, isImg, UserError } from "@/lib/validate";

export const maxDuration = 120;

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b) return bad("Invalid request");
  const selfie: Img | undefined = isImg(b.selfie) ? b.selfie : undefined;
  const outfit: Img | undefined = isImg(b.outfit) ? b.outfit : undefined;
  const audio: Img | undefined = isImg(b.audio, "audio") ? b.audio : undefined;
  const text: string = typeof b.text === "string" ? b.text.slice(0, 1000) : "";
  const current: { image: Img; garments: Garment[]; refs: Img[] } | undefined =
    isImg(b.current?.image) && isGarments(b.current?.garments)
      ? { image: b.current.image, garments: b.current.garments, refs: (b.current.refs ?? []).filter((r: unknown) => isImg(r)) }
      : undefined;
  if (!outfit && !text.trim() && !audio) return bad("Add an outfit photo, type a request, or record one.");

  try {
    const user = await currentUser();
    if (!user) return bad("Log in to use the studio.", 401);

    return await startJob(user, async () => {
      const intent: Intent =
        outfit && !text.trim() && !audio
          ? { tool: "steal_look" }
          : await routeIntent({ text, audio, hasOutfitPhoto: !!outfit, hasCurrentLook: !!current });
      const look = async (image: Img, garments: Garment[], refs: Img[]) =>
        ({ intent, look_id: await saveLook(user, image, garments, refs) });

      switch (intent.tool) {
        case "steal_look": {
          if (!selfie) throw new UserError("Add a photo of yourself first, using the person button.");
          if (!outfit) throw new UserError("Attach the outfit photo you want to copy.");
          const garments = await extractGarments(outfit);
          return look(await generateTryOn(selfie, garments, [outfit]), garments, [outfit]);
        }
        case "shop_and_dress": {
          if (!selfie) throw new UserError("Add a photo of yourself first, using the person button.");
          const found = await shopGarments(intent.request, intent.budget_usd, intent.categories);
          const changed = found.garments.map((g) => g.category);
          // A partial request ("only a blue top") is applied on top of the current look, if there is one.
          const partial = !!current && intent.categories.length > 0;
          const garments = partial
            ? [...current.garments.filter((g) => !changed.includes(g.category)), ...found.garments]
            : found.garments;
          const refs = partial ? [...current.refs, ...found.refs] : found.refs;
          const image = await generateTryOn(current?.image ?? selfie, found.garments, found.refs, intent.categories);
          return look(image, garments, refs);
        }
        case "micro_edit": {
          if (!current) throw new UserError("Make a look first, then ask for a change.");
          // shortcut: the receipt is not re-priced after an edit; re-run extractGarments on the result if that matters.
          return look(await editLook(current.image, intent.instruction), current.garments, current.refs);
        }
        case "find_similar": {
          const { rows } = await db.query(
            `SELECT id, author, garments, total_usd FROM looks
             WHERE shared AND embedding IS NOT NULL ORDER BY embedding <=> $1::vector LIMIT 6`,
            [toVector(await embed(intent.query))],
          );
          return { intent, similar: rows };
        }
        default:
          return { intent };
      }
    });
  } catch (e) {
    return fail(e);
  }
}
