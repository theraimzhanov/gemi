"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Img } from "@/lib/gemini";
import { blobToWav, fileToImg, takeHandoff, loadSelfie, post, saveSelfie, src, type FeedLook, type Look } from "@/lib/client";
import { btn, btnGhost, eyebrow, Header, Icon, iconBtn, LookCard, Receipt } from "./ui";

const TOOL_LABEL: Record<string, string> = {
  steal_look: "Steal This Look — copied the outfit from your photo",
  shop_and_dress: "Personal Shopper — searched the web for real items",
  micro_edit: "Micro-Edit — changed one detail",
  find_similar: "Closet Search — matched looks from the community",
  try_on: "Community look tried on you",
};

// Each card shows one thing Gemi can do; picking it fills the prompt (or opens the outfit picker).
const STARTERS = [
  { tag: "Steal This Look", title: "Copy an outfit from any photo", tint: "from-fuchsia-600/60 to-indigo-900/60", prompt: null },
  { tag: "Personal Shopper", title: "Find a red dress under $100", tint: "from-rose-600/60 to-orange-900/50", prompt: "Find a red dress under $100" },
  { tag: "Just one piece", title: "I only need a blue top", tint: "from-sky-600/60 to-indigo-900/60", prompt: "I only need a blue top" },
  { tag: "Closet Search", title: "Looks like streetwear with white sneakers", tint: "from-emerald-600/50 to-teal-900/60", prompt: "Show me community looks like streetwear with white sneakers" },
];

type ChatReply = Partial<Look> & { intent: { tool: string; message?: string }; similar?: FeedLook[] };

export default function Studio() {
  const [selfie, setSelfie] = useState<Img | null>(null);
  const [outfit, setOutfit] = useState<Img | null>(null);
  const [text, setText] = useState("");
  const [audio, setAudio] = useState<Img | null>(null);
  const [recording, setRecording] = useState(false);
  const [look, setLook] = useState<Look | null>(null);
  const [similar, setSimilar] = useState<FeedLook[]>([]);
  const [trending, setTrending] = useState<FeedLook[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [name, setName] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const selfieInput = useRef<HTMLInputElement>(null);
  const outfitInput = useRef<HTMLInputElement>(null);
  const promptBox = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Browser-only state, so it has to load after mount.
    /* eslint-disable react-hooks/set-state-in-effect */
    setSelfie(loadSelfie());
    setName(localStorage.getItem("gemi.name") ?? "");
    const handed = takeHandoff();
    if (handed) setLook(handed);
    /* eslint-enable react-hooks/set-state-in-effect */
    fetch("/api/looks")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: FeedLook[]) => setTrending(rows.slice(0, 4)))
      .catch(() => {}); // the strip is optional; the studio works without the feed
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

  const canSend = !busy && (!!outfit || !!text.trim() || !!audio);
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

  const tryShared = (id: number) => {
    if (!selfie) return setStatus("Add your photo first — use the person button in the prompt box.");
    run("Dressing you in that look… this can take up to a minute.", async () =>
      applyReply(await post<ChatReply>(`/api/looks/${id}/tryon`, { selfie })));
  };

  const pick = (set: (i: Img) => void, after?: (i: Img) => void) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    const img = await fileToImg(file);
    set(img);
    after?.(img);
  };

  function start(prompt: string | null) {
    if (prompt === null) return outfitInput.current?.click();
    setText(prompt);
    promptBox.current?.focus();
  }

  const chip = "flex items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-2 text-xs";
  const thumb = "size-7 rounded-full object-cover";
  const prompt = (
    <div className="w-full rounded-3xl border border-white/10 bg-white/[0.07] p-3 shadow-2xl shadow-black/40 backdrop-blur focus-within:border-fuchsia-400/60">
      <input ref={selfieInput} type="file" accept="image/*" className="hidden" aria-label="Upload your photo" onChange={pick(setSelfie, saveSelfie)} />
      <input ref={outfitInput} type="file" accept="image/*" className="hidden" aria-label="Upload an outfit photo" onChange={pick(setOutfit)} />
      {(selfie || outfit || audio) && (
        <div className="mb-2 flex flex-wrap gap-2">
          {selfie && (
            <span className={chip}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src(selfie)} alt="" className={thumb} /> You
            </span>
          )}
          {outfit && (
            <span className={chip}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src(outfit)} alt="" className={thumb} /> Outfit to copy
              <button onClick={() => setOutfit(null)} aria-label="Remove outfit photo" className="hover:text-white"><Icon name="close" className="size-3.5" /></button>
            </span>
          )}
          {audio && (
            <span className={`${chip} pl-2`}>
              <Icon name="mic" className="size-3.5" /> Voice request
              <button onClick={() => setAudio(null)} aria-label="Remove voice request" className="hover:text-white"><Icon name="close" className="size-3.5" /></button>
            </span>
          )}
        </div>
      )}
      <label htmlFor="ask" className="sr-only">Describe the look you want</label>
      <textarea
        id="ask" ref={promptBox} rows={2} value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (canSend) send(); } }}
        placeholder={look ? "Ask for a change… “swap the heels for sneakers”" : "Describe your look… “find a red dress under $100”"}
        className="w-full resize-none bg-transparent px-2 py-1 text-base placeholder:text-zinc-400 focus:outline-none"
      />
      <div className="flex items-center gap-1">
        <button className={iconBtn} onClick={() => outfitInput.current?.click()} disabled={busy} aria-label="Attach an outfit photo to copy" title="Attach an outfit photo"><Icon name="plus" /></button>
        <button className={iconBtn} onClick={() => selfieInput.current?.click()} disabled={busy} aria-label={selfie ? "Change your photo" : "Add your photo"} title="Your photo"><Icon name="person" /></button>
        <button className={iconBtn} onClick={toggleMic} disabled={busy} aria-pressed={recording} aria-label={recording ? "Stop recording" : "Speak your request"} title="Speak"><Icon name={recording ? "stop" : "mic"} /></button>
        {recording && <span className="text-xs text-fuchsia-300">Listening… tap to stop</span>}
        <button className={`${iconBtn} ml-auto bg-fuchsia-500 text-white hover:bg-fuchsia-400`} onClick={send} disabled={!canSend} aria-label="Style me">
          <Icon name="send" />
        </button>
      </div>
    </div>
  );

  const statusLine = <p role="status" aria-live="polite" className="min-h-5 text-center text-sm text-fuchsia-300">{status}</p>;

  return (
    <>
      <Header />
      {look ? (
        <main className="mx-auto grid w-full max-w-5xl gap-6 p-5 md:grid-cols-[minmax(0,1fr)_22rem]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src(look.image)} alt={`You wearing: ${look.garments.map((g) => g.description).join(", ")}`} className="fade-up w-full rounded-3xl border border-white/10" />
          <div className="space-y-5">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <Receipt garments={look.garments} total={look.total_usd} />
            </section>
            <section className="space-y-2 rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className={eyebrow}>Share</p>
              <label htmlFor="name" className="sr-only">Display name</label>
              <input
                id="name" value={name} placeholder="Display name" maxLength={40}
                onChange={(e) => { setName(e.target.value); localStorage.setItem("gemi.name", e.target.value); }}
                className="w-full rounded-full border border-white/15 bg-transparent px-4 py-2 text-sm placeholder:text-zinc-400"
              />
              <div className="flex gap-2">
                <button className={`${btn} flex-1`} disabled={busy || !name.trim()} onClick={share}>Share to community</button>
                <button className={btnGhost} onClick={() => { setLook(null); setStatus(""); }}>New look</button>
              </div>
            </section>
            {prompt}
            {statusLine}
          </div>
        </main>
      ) : (
        <main className="w-full">
          <section className="hero-glow px-5 pb-10 pt-20 md:pt-28">
            <div className="fade-up mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
              <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">Welcome to the fitting room</h1>
              <p className="text-lg text-zinc-400">Wear anything you can imagine. Show a photo, type it, or just say it.</p>
              {prompt}
              {statusLine}
              <div className="flex flex-wrap justify-center gap-2">
                {!selfie && <button className={btn} onClick={() => selfieInput.current?.click()}>Add your photo to start</button>}
                {STARTERS.map((s) => (
                  <button key={s.tag} className={btnGhost} onClick={() => start(s.prompt)}>{s.tag}</button>
                ))}
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-5xl space-y-3 px-5 py-8">
            <h2 className="text-lg font-semibold">Get started</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {STARTERS.map((s) => (
                <button
                  key={s.tag} onClick={() => start(s.prompt)}
                  className={`flex aspect-[4/3] flex-col justify-end rounded-2xl border border-white/10 bg-gradient-to-br ${s.tint} p-4 text-left transition hover:border-white/40 focus-visible:outline-2 focus-visible:outline-fuchsia-400`}
                >
                  <span className={eyebrow}>{s.tag}</span>
                  <span className="mt-1 text-sm font-medium">{s.title}</span>
                </button>
              ))}
            </div>
          </section>

          {similar.length > 0 && (
            <section className="mx-auto max-w-5xl space-y-3 px-5 py-8">
              <h2 className="text-lg font-semibold">Matches from the community</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {similar.map((s) => <LookCard key={s.id} look={s} busy={busy} onTry={() => tryShared(s.id)} />)}
              </div>
            </section>
          )}

          {trending.length > 0 && (
            <section className="mx-auto max-w-5xl space-y-3 px-5 py-8">
              <div className="flex items-end justify-between">
                <div>
                  <p className={eyebrow}>Share</p>
                  <h2 className="text-2xl font-semibold">Trending in the community</h2>
                </div>
                <Link href="/feed" className={btnGhost}>See all</Link>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {trending.map((s) => <LookCard key={s.id} look={s} busy={busy} onTry={() => tryShared(s.id)} />)}
              </div>
            </section>
          )}

          <section className="mx-auto grid max-w-5xl gap-8 px-5 py-14 md:grid-cols-3">
            {[
              ["Create", "One box, any input", "Photo, text or voice. Gemi works out what you mean and picks the right tool by itself."],
              ["Shop", "Real clothes, real prices", "Gemi searches the web for items in your budget and gives you an itemized receipt with store links."],
              ["Share", "One click to try it on", "Publish a look and anyone can wear the same outfit with only their own photo."],
            ].map(([tag, title, body]) => (
              <div key={tag} className="space-y-2 border-t border-white/10 pt-5">
                <p className={eyebrow}>{tag}</p>
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="text-sm leading-6 text-zinc-400">{body}</p>
              </div>
            ))}
          </section>
        </main>
      )}
    </>
  );
}
