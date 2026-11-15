"use client";
import { useEffect, useRef, useState } from "react";
import type { Garment, Img } from "@/lib/gemini";
import { blobToWav, fileToImg, loadSelfie, post, saveSelfie, src, type FeedLook } from "@/lib/client";
import { btn, btnGhost, describeLook, display, Icon, iconBtn, LookCard, Receipt } from "../../ui";
import { useMe } from "../shell";
import { MAX_PHOTOS, MAX_UPLOAD_B64, type Shopping } from "@/lib/styling";
import { Choices } from "./choices";

const TOOL_LABEL: Record<string, string> = {
  steal_look: "Copied the outfit from your photo",
  shop_and_dress: "Searched the web for real items",
  micro_edit: "Changed one detail",
  find_similar: "Matched looks from the community",
  try_on: "Tried a community look on you",
};
const IDEAS = ["Find a red dress under $100", "I only need a blue top", "Find me an interview outfit a week before December 10"];
// HackUTA theme: looks named after the Odyssey. Each is an ordinary request the agent searches, budgets and tries on.
const ODYSSEY = [
  ["Odysseus", "the long trip", "Find a rugged travel outfit for a long trip under $150"],
  ["Penelope", "the elegant knit", "Find an elegant knit outfit under $120"],
  ["Athena", "the big moment", "Find a sharp outfit for a big presentation under $200"],
  ["Circe", "the evening", "Find an evening look that turns heads under $150"],
  ["Ithaca", "the homecoming", "Find me an outfit for coming home for the holidays a week before December 20"],
];

// One request and its answer, as stored in the database. The chat is this list, so it survives leaving the page.
type Job = {
  id: number;
  status: "working" | "done" | "failed";
  error?: string;
  request: { text?: string; photos?: number; voice?: boolean };
  reply?: {
    intent: { tool: string; message?: string };
    look?: { id: number; shared: boolean; garments: Garment[]; total_usd: number };
    similar?: FeedLook[];
    shopping?: Shopping & { job: number };
  };
};

const bubble = "w-fit rounded-3xl rounded-bl-md bg-mist px-5 py-3";

export default function Chat() {
  const me = useMe();
  const [selfie, setSelfie] = useState<Img | null>(null);
  const [outfits, setOutfits] = useState<Img[]>([]);
  const [uploading, setUploading] = useState(false);
  const [text, setText] = useState("");
  const [audio, setAudio] = useState<Img | null>(null);
  const [recording, setRecording] = useState(false);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [sentPhotos, setSentPhotos] = useState<Record<number, Img[]>>({}); // thumbnails for this visit only
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [menu, setMenu] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const selfieInput = useRef<HTMLInputElement>(null);
  const outfitInput = useRef<HTMLInputElement>(null);
  const promptBox = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only state, loaded after mount
    setSelfie(loadSelfie());
    const load = () => fetch("/api/jobs").then((r) => (r.ok ? r.json() : Promise.reject())).then(setJobs);
    load().catch(() => { setJobs([]); setNotice("Your earlier chat did not load. Check your connection and reload the page."); });
    // Planned searches finish on their own, so look for new answers now and then.
    const timer = setInterval(() => { if (!document.hidden) load().catch(() => {}); }, 30_000);
    return () => clearInterval(timer);
  }, []);

  // Work continues on the server whether or not this page is open; while it is open, ask how it is going.
  const working = jobs?.filter((j) => j.status === "working").map((j) => j.id).join(",") ?? "";
  useEffect(() => {
    if (!working) return;
    const timer = setInterval(async () => {
      for (const id of working.split(",")) {
        const res = await fetch(`/api/jobs/${id}`).catch(() => null);
        if (!res?.ok) continue; // a dropped connection: keep waiting, the job carries on without us
        const job: Job = await res.json();
        setJobs((js) => js && js.map((j) => (j.id === job.id ? job : j)));
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [working]);

  // Braces matter: newer browsers return a Promise from scrollIntoView, which an effect must not return.
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [jobs?.length, working, notice]);

  const busy = sending || !!working;
  // The newest look is what follow-up edits apply to.
  const current = jobs?.findLast((j) => j.reply?.look)?.reply?.look;

  async function submit(url: string, body: unknown, photos: Img[] = []) {
    setNotice("");
    setSending(true);
    try {
      const { job } = await post<{ job: number }>(url, body);
      const view: Job = await fetch(`/api/jobs/${job}`).then((r) => r.json());
      if (photos.length) setSentPhotos((p) => ({ ...p, [job]: photos }));
      setJobs((js) => [...(js ?? []), view]);
      return true;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Something went wrong. Try again.");
      return false;
    } finally {
      setSending(false);
    }
  }

  const canSend = !busy && !uploading && !recording && (!!outfits.length || !!text.trim() || !!audio);
  async function send() {
    if (!canSend) return;
    if ([...outfits, selfie, audio].reduce((sum, image) => sum + (image?.data.length ?? 0), 0) > MAX_UPLOAD_B64)
      return setNotice("These attachments are too large together. Use fewer photos or a shorter recording.");
    const sent = { selfie, outfits, text, audio, currentId: current?.id };
    setText(""); setAudio(null); setOutfits([]);
    // Nothing was saved if this fails, so give the request back to edit and resend.
    if (!(await submit("/api/chat", sent, outfits))) { setText(sent.text); setAudio(sent.audio); setOutfits(sent.outfits); }
  }

  async function toggleMic() {
    if (recording) return recorder.current?.stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        try { setAudio(await blobToWav(new Blob(chunks))); }
        catch { setNotice("The recording could not be read. Please record again or type your request."); }
      };
      recorder.current = rec;
      rec.start();
      setTimeout(() => { if (rec.state === "recording") rec.stop(); }, 30_000);
      setNotice("");
      setRecording(true);
    } catch {
      setNotice("The microphone is blocked in this browser. Type your request instead.");
    }
  }

  async function share(id: number) {
    try {
      await post("/api/looks", { id });
      setJobs((js) => js && js.map((j) => (j.reply?.look?.id === id ? { ...j, reply: { ...j.reply, look: { ...j.reply.look!, shared: true } } } : j)));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "That look could not be shared. Try again.");
    }
  }

  async function clearChat() {
    setMenu(false);
    if (!window.confirm("Clear this chat and start a new one? The messages are removed for good. Your looks stay in My looks.")) return;
    const res = await fetch("/api/jobs", { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return setNotice("The chat could not be cleared. Check your connection and try again.");
    setJobs([]); setSentPhotos({}); setNotice("");
  }

  const needSelfie = () => { setNotice("Add your photo first, using the person button below."); };
  const tryShared = (id: number) => (selfie ? submit(`/api/looks/${id}/tryon`, { selfie }) : needSelfie());
  const confirm = (shopping: Shopping & { job: number }, indices: number[]) =>
    selfie || current ? submit("/api/chat", { selfie, currentId: current?.id, selection: { job: shopping.job, indices } }) : needSelfie();

  const pick = (set: (i: Img) => void, after?: (i: Img) => void) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    setUploading(true);
    try {
      const img = await fileToImg(file);
      set(img);
      after?.(img);
      setNotice("");
    } catch { setNotice("That photo could not be opened. Try a JPG, PNG or WebP image."); }
    finally { setUploading(false); }
  };

  async function pickOutfits(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (outfits.length + files.length > MAX_PHOTOS) return setNotice(`Attach up to ${MAX_PHOTOS} photos at a time.`);
    setUploading(true);
    try {
      const images = await Promise.all(files.map((file) => fileToImg(file, 768)));
      setOutfits((previous) => [...previous, ...images]);
    } catch { setNotice("One of those photos could not be opened. Try JPG, PNG or WebP images."); }
    finally { setUploading(false); }
  }

  const chip = "flex items-center gap-2 rounded-full bg-mist py-1 pl-1 pr-2.5 text-xs font-medium";
  const gemi = (
    <div className="flex items-center gap-1 text-sm font-semibold">
      {/* eslint-disable-next-line @next/next/no-img-element -- local vector brand mark */}
      <img src="/icon.svg" alt="" width={32} height={32} className="size-8" />
      Gemi
    </div>
  );

  return (
    <>
      <input ref={selfieInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Upload your photo" onChange={pick(setSelfie, saveSelfie)} />
      <input ref={outfitInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" multiple aria-label="Upload product or outfit photos" onChange={pickOutfits} />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 pb-24 pt-8 md:pb-6">
        {jobs?.length === 0 && (
          <div className="m-auto w-full max-w-xl py-10">
            <h1 className={`${display} text-5xl leading-none md:text-6xl`}>What are we wearing today, {me.username}?</h1>
            <p className="mt-4 text-lg text-mute">I’m Gemi, your AI stylist. Attach product or outfit photos, add instructions, or describe what you want to shop for. You can also say it out loud.</p>
            {!selfie && (
              <button className={`${btn} mt-6`} onClick={() => selfieInput.current?.click()}><Icon name="user" /> Add your photo to start</button>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              {IDEAS.map((idea) => (
                <button key={idea} className={btnGhost} onClick={() => { setText(idea); promptBox.current?.focus(); }}>{idea}</button>
              ))}
            </div>
            <h2 className="mt-8 text-sm font-semibold uppercase tracking-widest text-berry">Dress for your odyssey</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {ODYSSEY.map(([name, moment, ask]) => (
                <button key={name} className={btnGhost} title={ask} onClick={() => { setText(ask); promptBox.current?.focus(); }}>
                  {name}<span className="font-normal text-mute">: {moment}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {!!jobs?.length && (
          <div className="sticky top-3 z-20 -mb-5 mr-auto">
            <button className={`${iconBtn} bg-white shadow-sm`} onClick={() => setMenu((open) => !open)} aria-expanded={menu} aria-haspopup="menu" aria-label="Chat options" title="Chat options"><Icon name="more" className="size-6" /></button>
            {menu && (
              <div role="menu" className="absolute left-0 mt-2 w-44 rounded-2xl border border-line bg-white p-1 shadow-[0_8px_30px_rgb(27_23_34/0.12)]">
                <button role="menuitem" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-berry hover:bg-mist" onClick={clearChat}><Icon name="trash" className="size-4" /> Clear chat</button>
              </div>
            )}
          </div>
        )}

        {jobs?.map((j) => {
          const r = j.reply;
          const photos = sentPhotos[j.id];
          const words = j.request.text || (j.request.voice ? "Voice request" : "");
          return (
            <div key={j.id} className="contents">
              <div className="pop ml-auto flex max-w-[80%] flex-col items-end gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {photos?.map((photo, index) => <img key={index} src={src(photo)} alt={`Reference photo ${index + 1} you attached`} className="w-40 rounded-3xl" />)}
                {!photos && !!j.request.photos && <p className="text-sm text-mute">{j.request.photos} {j.request.photos === 1 ? "photo" : "photos"} attached</p>}
                {words && (
                  <p className="flex items-center gap-2 whitespace-pre-line rounded-3xl rounded-br-md bg-ink px-5 py-3 text-white">
                    {j.request.voice && <Icon name="mic" className="size-4 shrink-0" />}{words}
                  </p>
                )}
              </div>

              <div className="pop max-w-full space-y-3">
                {gemi}
                {j.status === "working" && (
                  <div className={bubble} role="status">
                    <p className="pulse-dots flex items-center gap-1.5 py-1">
                      <span className="size-2 rounded-full bg-ink" /><span className="size-2 rounded-full bg-ink" /><span className="size-2 rounded-full bg-ink" />
                    </p>
                    <p className="mt-1 text-sm text-mute">Gemi has set sail: searching, choosing and dressing you. This can take a few minutes. You can leave this page or close the tab; the answer will be here when you come back.</p>
                  </div>
                )}
                {j.status === "failed" && <p className={bubble}>{j.error ?? "Something went wrong making that. Try again."}</p>}
                {r && <p className={bubble}>{r.intent.message ?? TOOL_LABEL[r.intent.tool] ?? "Done"}</p>}
                {r?.shopping && <Choices shopping={r.shopping} busy={busy || uploading} onConfirm={(indices) => confirm(r.shopping!, indices)} />}
                {r?.look && (
                  <div className="grid gap-5 rounded-[2rem] border border-line p-4 sm:grid-cols-[minmax(0,15rem)_1fr]">
                    {/* eslint-disable-next-line @next/next/no-img-element -- served from our own DB route */}
                    <img src={`/api/img/${r.look.id}`} alt={`You wearing ${describeLook(r.look.garments)}`} width={600} height={800} className="h-auto w-full rounded-3xl" />
                    <div className="flex flex-col gap-4">
                      <Receipt garments={r.look.garments} total={r.look.total_usd} />
                      <div className="mt-auto flex flex-wrap items-center gap-2">
                        {r.look.shared ? (
                          <p className="flex items-center gap-2 text-sm font-semibold text-berry"><Icon name="check" /> Shared to the community</p>
                        ) : (
                          <button className={btn} onClick={() => share(r.look!.id)}><Icon name="share" /> Share to community</button>
                        )}
                        <a className={btnGhost} href={`/api/img/${r.look.id}?download`} download><Icon name="download" /> Download</a>
                      </div>
                    </div>
                  </div>
                )}
                {r?.similar && (r.similar.length ? (
                  <div className="masonry columns-2 sm:columns-3">
                    {r.similar.map((s) => (
                      <LookCard key={s.id} author={s.author} total={s.total_usd}
                        // eslint-disable-next-line @next/next/no-img-element
                        image={<img src={`/api/img/${s.id}`} alt={`Look by ${s.author}: ${describeLook(s.garments)}`} width={600} height={800} className="h-auto w-full" />}>
                        <button className="flex-1 rounded-full bg-white py-2 text-sm font-semibold" disabled={busy} onClick={() => tryShared(s.id)}>Try on me</button>
                      </LookCard>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-mute">Nothing in the community matches that yet.</p>
                ))}
              </div>
            </div>
          );
        })}

        {sending && <p className={`${bubble} text-sm text-mute`} role="status">Sending…</p>}
        {notice && (
          <div className="pop space-y-3" role="alert">
            {gemi}
            <p className={bubble}>{notice}</p>
          </div>
        )}
        <div ref={end} className="scroll-mb-44" />
      </main>

      <div className="sticky bottom-16 z-10 bg-gradient-to-t from-white via-white to-transparent px-4 pb-4 pt-6 md:bottom-0">
        <div className="mx-auto w-full max-w-3xl rounded-[1.75rem] border border-line bg-white p-2 shadow-[0_8px_30px_rgb(27_23_34/0.08)] focus-within:border-ink">
          {(outfits.length > 0 || audio) && (
            <div className="flex flex-wrap gap-2 px-2 pt-1">
              {outfits.map((photo, index) => (
                <span key={index} className={chip}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src(photo)} alt="" className="size-7 rounded-full object-cover" /> Photo {index + 1}
                  <button onClick={() => setOutfits((photos) => photos.filter((_, i) => i !== index))} aria-label={`Remove reference photo ${index + 1}`}><Icon name="close" className="size-3.5" /></button>
                </span>
              ))}
              {audio && (
                <span className={`${chip} pl-2.5`}>
                  <Icon name="mic" className="size-3.5" /> Voice request ready. Press send.
                  <button onClick={() => setAudio(null)} aria-label="Remove voice request"><Icon name="close" className="size-3.5" /></button>
                </span>
              )}
            </div>
          )}
          {uploading && <p role="status" className="px-3 text-sm text-mute">Preparing photos…</p>}
          <label htmlFor="ask" className="sr-only">Describe the look you want</label>
          <textarea
            id="ask" ref={promptBox} rows={1} value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={current ? "Ask for a change, like “swap the heels for sneakers”" : "Describe the look you want"}
            className="block w-full resize-none bg-transparent px-3 py-2 text-base placeholder:text-mute focus:outline-none"
          />
          <div className="flex items-center gap-1">
            <button className={iconBtn} onClick={() => outfitInput.current?.click()} disabled={busy || uploading} aria-label="Attach product or outfit photos" title="Attach photos"><Icon name="plus" /></button>
            <button className={iconBtn} onClick={() => selfieInput.current?.click()} disabled={busy || uploading} aria-label={selfie ? "Change your photo" : "Add your photo"} title="Your photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {selfie ? <img src={src(selfie)} alt="" className="size-7 rounded-full object-cover" /> : <Icon name="user" />}
            </button>
            <button className={iconBtn} onClick={toggleMic} disabled={busy} aria-pressed={recording} aria-label={recording ? "Stop recording" : "Speak your request"} title="Speak"><Icon name={recording ? "stop" : "mic"} /></button>
            {recording && <span className="text-sm font-medium text-berry">Listening. Tap the square to stop.</span>}
            <button className="ml-auto grid size-10 place-items-center rounded-full bg-ink text-white transition-colors hover:bg-berry disabled:opacity-30" onClick={send} disabled={!canSend} aria-label="Send">
              <Icon name="send" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
