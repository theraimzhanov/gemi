"use client";
import { useEffect, useRef, useState } from "react";
import type { Img } from "@/lib/gemini";
import { blobToWav, fileToImg, takeHandoff, loadSelfie, post, saveSelfie, src, type FeedLook, type Look } from "@/lib/client";
import { btn, btnGhost, Header, LookCard, Receipt } from "./ui";

const TOOL_LABEL: Record<string, string> = {
  steal_look: "Steal This Look — copied the outfit from your photo",
  shop_and_dress: "Personal Shopper — searched the web for real items",
  micro_edit: "Micro-Edit — changed one detail",
  find_similar: "Closet Search — matched looks from the community",
  try_on: "Community look tried on you",
};

type ChatReply = Partial<Look> & { intent: { tool: string; message?: string }; similar?: FeedLook[] };

export default function Studio() {
  const [selfie, setSelfie] = useState<Img | null>(null);
  const [outfit, setOutfit] = useState<Img | null>(null);
  const [text, setText] = useState("");
  const [audio, setAudio] = useState<Img | null>(null);
  const [recording, setRecording] = useState(false);
  const [look, setLook] = useState<Look | null>(null);
  const [similar, setSimilar] = useState<FeedLook[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [name, setName] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    // Browser-only state, so it has to load after mount.
    /* eslint-disable react-hooks/set-state-in-effect */
    setSelfie(loadSelfie());
    setName(localStorage.getItem("gemi.name") ?? "");
    const handed = takeHandoff();
    if (handed) setLook(handed);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  async function run(label: string, job: () => Promise<void>) {
    setBusy(true);
    setStatus(label);
    try {
      await job();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function applyReply(r: ChatReply) {
    if (r.image && r.garments) setLook({ image: r.image, garments: r.garments, refs: r.refs ?? [], total_usd: r.total_usd ?? 0, intent: r.intent });
    setSimilar(r.similar ?? []);
    setStatus(r.intent.message ?? `Gemi chose: ${TOOL_LABEL[r.intent.tool] ?? r.intent.tool}`);
  }

  const send = () =>
    run("Gemi is working out what you need… this can take up to a minute.", async () => {
      applyReply(await post<ChatReply>("/api/chat", { selfie, outfit, text, audio, current: look }));
      setText(""); setAudio(null); setOutfit(null);
    });

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
        setAudio(await blobToWav(new Blob(chunks)));
      };
      recorder.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setStatus("Microphone access was blocked. You can type your request instead.");
    }
  }

  const share = () =>
    run("Sharing…", async () => {
      await post("/api/looks", { author: name, image: look!.image, garments: look!.garments, refs: look!.refs });
      setStatus("Shared to the community feed.");
    });

  const trySimilar = (id: number) =>
    run("Dressing you in that look…", async () => applyReply(await post<ChatReply>(`/api/looks/${id}/tryon`, { selfie })));

  const pick = (set: (i: Img) => void, after?: (i: Img) => void) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = await fileToImg(file);
    set(img);
    after?.(img);
  };

  return (
    <>
      <Header />
      <main className="mx-auto grid w-full max-w-5xl gap-6 p-4 md:grid-cols-2">
        <section className="space-y-4">
          <div>
            <label htmlFor="selfie" className="block text-sm font-semibold">1. Your photo</label>
            <p className="text-xs text-zinc-500">Full-body works best. It stays in this browser.</p>
            <input id="selfie" type="file" accept="image/*" className="mt-1 text-sm" onChange={pick(setSelfie, saveSelfie)} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {selfie && <img src={src(selfie)} alt="Your photo" className="mt-2 h-40 rounded-xl object-cover" />}
          </div>

          <div>
            <label htmlFor="outfit" className="block text-sm font-semibold">2. An outfit photo (optional)</label>
            <input id="outfit" type="file" accept="image/*" className="mt-1 text-sm" onChange={pick(setOutfit)} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {outfit && <img src={src(outfit)} alt="Outfit to copy" className="mt-2 h-40 rounded-xl object-cover" />}
          </div>

          <div>
            <label htmlFor="ask" className="block text-sm font-semibold">3. Or tell Gemi what you want</label>
            <textarea
              id="ask" rows={3} value={text} onChange={(e) => setText(e.target.value)}
              placeholder={'"Find a red dress under $100" · "I only need a blue top" · "Swap the heels for sneakers"'}
              className="mt-1 w-full rounded-xl border border-zinc-300 bg-transparent p-3 text-sm dark:border-zinc-700"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button className={btn} disabled={busy || (!outfit && !text.trim() && !audio)} onClick={send}>
                {busy ? "Working…" : "Style me"}
              </button>
              <button className={btnGhost} onClick={toggleMic} aria-pressed={recording} disabled={busy}>
                {recording ? "■ Stop recording" : audio ? "🎤 Re-record" : "🎤 Speak"}
              </button>
              {audio && !recording && <span className="text-xs text-zinc-500">Voice request ready</span>}
            </div>
          </div>
          <p role="status" aria-live="polite" className="min-h-5 text-sm text-fuchsia-700 dark:text-fuchsia-400">{status}</p>
        </section>

        <section className="space-y-4">
          {look ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src(look.image)} alt={`You wearing: ${look.garments.map((g) => g.description).join(", ")}`} className="w-full rounded-2xl" />
              <Receipt garments={look.garments} total={look.total_usd} />
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="name" className="sr-only">Display name</label>
                <input
                  id="name" value={name} placeholder="Display name" maxLength={40}
                  onChange={(e) => { setName(e.target.value); localStorage.setItem("gemi.name", e.target.value); }}
                  className="rounded-full border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
                />
                <button className={btn} disabled={busy || !name.trim()} onClick={share}>Share to community</button>
                <button className={btnGhost} onClick={() => setLook(null)}>Start over</button>
              </div>
            </>
          ) : (
            <div className="grid aspect-[3/4] place-items-center rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
              Your look appears here.
            </div>
          )}
          {similar.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {similar.map((s) => <LookCard key={s.id} look={s} busy={busy} onTry={() => trySimilar(s.id)} />)}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
