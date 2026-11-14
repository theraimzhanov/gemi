"use client";
import { useEffect, useRef, useState } from "react";
import type { Img } from "@/lib/gemini";
import { fileToImg, loadSelfie, saveSelfie, src } from "@/lib/client";
import { btn, btnGhost, display, Icon } from "../../ui";

export function ProfileControls() {
  const [selfie, setSelfie] = useState<Img | null>(null);
  const input = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only state, loaded after mount
  useEffect(() => setSelfie(loadSelfie()), []);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const img = await fileToImg(file);
    saveSelfie(img);
    setSelfie(img);
  }
  const remove = () => { localStorage.removeItem("gemi.selfie"); setSelfie(null); };
  // A full page load on purpose: it drops every piece of the previous user's in-memory state.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  const logout = () => fetch("/api/auth", { method: "DELETE" }).finally(() => location.assign("/"));

  return (
    <>
      <section className="mt-8 flex flex-wrap items-center gap-5 rounded-[2rem] border border-line p-5">
        {selfie ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src(selfie)} alt="Your photo" className="h-36 w-28 rounded-2xl object-cover" />
        ) : (
          <div className="grid h-36 w-28 place-items-center rounded-2xl bg-mist text-mute"><Icon name="user" className="size-8" /></div>
        )}
        <div className="min-w-0 flex-1 basis-56">
          <h2 className={`${display} text-2xl`}>Your photo</h2>
          <p className="mt-1 text-sm text-mute">Gemi dresses this photo. It is kept in this browser only and is sent just while a look is being made. A full-body photo works best.</p>
          <input ref={input} type="file" accept="image/*" className="hidden" aria-label="Upload your photo" onChange={pick} />
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={btn} onClick={() => input.current?.click()}>{selfie ? "Change photo" : "Add photo"}</button>
            {selfie && <button className={btnGhost} onClick={remove}>Remove photo</button>}
          </div>
        </div>
      </section>
      <button className={`${btnGhost} mt-8`} onClick={logout}><Icon name="logout" /> Log out</button>
    </>
  );
}
