"use client";
import { useEffect, useRef, useState } from "react";
import type { Img } from "@/lib/gemini";
import { blobToWav, fileToImg, takeHandoff, loadSelfie, post, saveSelfie, src, type FeedLook, type Look } from "@/lib/client";
import { btn, btnGhost, describeLook, display, Icon, iconBtn, LookCard, Receipt } from "../../ui";
import { useMe } from "../shell";

const TOOL_LABEL: Record<string, string> = {
  steal_look: "Copied the outfit from your photo",
  shop_and_dress: "Searched the web for real items",
  micro_edit: "Changed one detail",
  find_similar: "Matched looks from the community",
  try_on: "Tried a community look on you",
};
const IDEAS = ["Find a red dress under $100", "I only need a blue top", "Show me looks like streetwear with white sneakers"];

type Reply = Partial<Look> & { intent: { tool: string; message?: string }; similar?: FeedLook[] };
type Msg =
  | { from: "you"; text: string; outfit?: Img; voice?: boolean }
  | { from: "gemi"; note: string; look?: Look; similar?: FeedLook[] };

const toMsg = (r: Reply): Msg => ({
  from: "gemi",
  note: r.intent.message ?? TOOL_LABEL[r.intent.tool] ?? "Done",
  look: r.image && r.garments ? { id: r.id, image: r.image, garments: r.garments, refs: r.refs ?? [], total_usd: r.total_usd ?? 0 } : undefined,
  similar: r.similar,
});

export default function Chat() {
  const me = useMe();
  const [selfie, setSelfie] = useState<Img | null>(null);
  const [outfit, setOutfit] = useState<Img | null>(null);
  const [text, setText] = useState("");
  const [audio, setAudio] = useState<Img | null>(null);
  const [recording, setRecording] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const selfieInput = useRef<HTMLInputElement>(null);
  const outfitInput = useRef<HTMLInputElement>(null);
  const promptBox = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Browser-only state, so it has to load after mount.
    /* eslint-disable react-hooks/set-state-in-effect */
    setSelfie(loadSelfie());
    const handed = takeHandoff();
    if (handed) setMsgs([{ from: "gemi", note: TOOL_LABEL.try_on, look: handed }]);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  // Braces matter: newer browsers return a Promise from scrollIntoView, which an effect must not return.
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy]);

  let current: Look | undefined; // the newest look is what follow-up edits apply to
  for (const m of msgs) if (m.from === "gemi" && m.look) current = m.look;
  const say = (note: string) => setMsgs((m) => [...m, { from: "gemi", note }]);

  async function run(job: () => Promise<Reply>) {
    setBusy(true);
    try {
      const reply = toMsg(await job());
      setMsgs((m) => [...m, reply]);
    } catch (e) {
      say(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const canSend = !busy && (!!outfit || !!text.trim() || !!audio);
  function send() {
    const sent = { selfie, outfit, text, audio, current };
    setMsgs((m) => [...m, { from: "you", text: text.trim(), outfit: outfit ?? undefined, voice: !!audio }]);
    setText(""); setAudio(null); setOutfit(null);
    run(() => post<Reply>("/api/chat", sent));
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
        setAudio(await blobToWav(new Blob(chunks)));
      };
      recorder.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      say("The microphone is blocked in this browser. Type your request instead.");
    }
  }

  async function share(look: Look) {
    try {
      await post("/api/looks", { id: look.id });
      setMsgs((m) => m.map((x) => (x.from === "gemi" && x.look === look ? { ...x, look: { ...look, shared: true } } : x)));
    } catch (e) {
      say(e instanceof Error ? e.message : "That look could not be shared. Try again.");
    }
  }

  const tryShared = (id: number) => {
    if (!selfie) return say("Add your photo first, using the person button below.");
    setMsgs((m) => [...m, { from: "you", text: "Try this look on me" }]);
    run(() => post<Reply>(`/api/looks/${id}/tryon`, { selfie }));
  };

  const pick = (set: (i: Img) => void, after?: (i: Img) => void) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    const img = await fileToImg(file);
    set(img);
    after?.(img);
  };

  const chip = "flex items-center gap-2 rounded-full bg-mist py-1 pl-1 pr-2.5 text-xs font-medium";

  return (
    <>
      <input ref={selfieInput} type="file" accept="image/*" className="hidden" aria-label="Upload your photo" onChange={pick(setSelfie, saveSelfie)} />
      <input ref={outfitInput} type="file" accept="image/*" className="hidden" aria-label="Upload an outfit photo" onChange={pick(setOutfit)} />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 pb-6 pt-8">
        {msgs.length === 0 && (
          <div className="m-auto w-full max-w-xl py-10">
            <h1 className={`${display} text-5xl leading-none md:text-6xl`}>What are we wearing today, {me.username}?</h1>
            <p className="mt-4 text-lg text-mute">Attach an outfit photo to copy it, or describe what you want. You can also say it out loud.</p>
            {!selfie && (
              <button className={`${btn} mt-6`} onClick={() => selfieInput.current?.click()}><Icon name="user" /> Add your photo to start</button>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              {IDEAS.map((idea) => (
                <button key={idea} className={btnGhost} onClick={() => { setText(idea); promptBox.current?.focus(); }}>{idea}</button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m, i) =>
          m.from === "you" ? (
            <div key={i} className="pop ml-auto flex max-w-[80%] flex-col items-end gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {m.outfit && <img src={src(m.outfit)} alt="Outfit photo you attached" className="w-40 rounded-3xl" />}
              {(m.text || m.voice) && (
                <p className="rounded-3xl rounded-br-md bg-ink px-5 py-3 text-white">{m.text || "Voice request"}</p>
              )}
            </div>
          ) : (
            <div key={i} className="pop max-w-full space-y-3">
              <p className="w-fit rounded-3xl rounded-bl-md bg-mist px-5 py-3">{m.note}</p>
              {m.look && (
                <div className="grid gap-5 rounded-[2rem] border border-line p-4 sm:grid-cols-[minmax(0,15rem)_1fr]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src(m.look.image)} alt={`You wearing ${describeLook(m.look.garments)}`} className="w-full rounded-3xl" />
                  <div className="flex flex-col gap-4">
                    <Receipt garments={m.look.garments} total={m.look.total_usd} />
                    {m.look.shared ? (
                      <p className="mt-auto flex items-center gap-2 text-sm font-semibold text-berry"><Icon name="check" /> Shared to the community</p>
                    ) : m.look.id ? (
                      <button className={`${btn} mt-auto self-start`} onClick={() => share(m.look!)}><Icon name="share" /> Share to community</button>
                    ) : null}
                  </div>
                </div>
              )}
              {m.similar && (m.similar.length ? (
                <div className="masonry columns-2 sm:columns-3">
                  {m.similar.map((s) => (
                    <LookCard key={s.id} author={s.author} total={s.total_usd}
                      // eslint-disable-next-line @next/next/no-img-element
                      image={<img src={`/api/img/${s.id}`} alt={`Look by ${s.author}: ${describeLook(s.garments)}`} className="w-full" />}>
                      <button className="flex-1 rounded-full bg-white py-2 text-sm font-semibold" disabled={busy} onClick={() => tryShared(s.id)}>Try on me</button>
                    </LookCard>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-mute">Nothing in the community matches that yet.</p>
              ))}
            </div>
          ),
        )}

        {busy && (
          <p className="pulse-dots flex w-fit items-center gap-1.5 rounded-3xl rounded-bl-md bg-mist px-5 py-4" role="status">
            <span className="size-2 rounded-full bg-ink" /><span className="size-2 rounded-full bg-ink" /><span className="size-2 rounded-full bg-ink" />
            <span className="sr-only">Gemi is styling you. This can take up to a minute.</span>
          </p>
        )}
        <div ref={end} />
      </main>

      <div className="sticky bottom-16 z-10 bg-gradient-to-t from-white via-white to-transparent px-4 pb-4 pt-6 md:bottom-0">
        <div className="mx-auto w-full max-w-3xl rounded-[1.75rem] border border-line bg-white p-2 shadow-[0_8px_30px_rgb(27_23_34/0.08)] focus-within:border-ink">
          {(outfit || audio) && (
            <div className="flex flex-wrap gap-2 px-2 pt-1">
              {outfit && (
                <span className={chip}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src(outfit)} alt="" className="size-7 rounded-full object-cover" /> Outfit to copy
                  <button onClick={() => setOutfit(null)} aria-label="Remove outfit photo"><Icon name="close" className="size-3.5" /></button>
                </span>
              )}
              {audio && (
                <span className={`${chip} pl-2.5`}>
                  <Icon name="mic" className="size-3.5" /> Voice request
                  <button onClick={() => setAudio(null)} aria-label="Remove voice request"><Icon name="close" className="size-3.5" /></button>
                </span>
              )}
            </div>
          )}
          <label htmlFor="ask" className="sr-only">Describe the look you want</label>
          <textarea
            id="ask" ref={promptBox} rows={1} value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (canSend) send(); } }}
            placeholder={current ? "Ask for a change, like “swap the heels for sneakers”" : "Describe the look you want"}
            className="block w-full resize-none bg-transparent px-3 py-2 text-base placeholder:text-mute focus:outline-none"
          />
          <div className="flex items-center gap-1">
            <button className={iconBtn} onClick={() => outfitInput.current?.click()} disabled={busy} aria-label="Attach an outfit photo to copy" title="Attach an outfit photo"><Icon name="plus" /></button>
            <button className={iconBtn} onClick={() => selfieInput.current?.click()} disabled={busy} aria-label={selfie ? "Change your photo" : "Add your photo"} title="Your photo">
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
