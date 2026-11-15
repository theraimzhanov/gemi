"use client";
import { useEffect, useRef, useState } from "react";
import type { Img } from "@/lib/gemini";
import { fileToImg, loadSelfie, saveSelfie, src, post } from "@/lib/client";
import type { Preferences } from "@/lib/styling";
import { btn, btnGhost, display, Icon } from "../../ui";

export function ProfileControls({ preferences }: { preferences: Preferences }) {
  const [prefs, setPrefs] = useState(preferences);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [selfie, setSelfie] = useState<Img | null>(null);
  const input = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only state, loaded after mount
  useEffect(() => setSelfie(loadSelfie()), []);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const img = await fileToImg(file);
      saveSelfie(img);
      setSelfie(img);
    } catch { setStatus("That photo could not be opened. Try a JPG, PNG or WebP image."); }
  }
  const remove = () => { localStorage.removeItem("gemi.selfie"); setSelfie(null); };
  // A full page load on purpose: it drops every piece of the previous user's in-memory state.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  const logout = () => fetch("/api/auth", { method: "DELETE" }).finally(() => location.assign("/"));

  return (
    <>
      <form className="mt-8 space-y-4 rounded-[2rem] border border-line p-5" onSubmit={async (e) => {
        e.preventDefault(); setSaving(true); setStatus("");
        try { await post("/api/profile", prefs); setStatus("Shopping preferences saved."); }
        catch (error) { setStatus(error instanceof Error ? error.message : "Could not save preferences."); }
        finally { setSaving(false); }
      }}>
        <h2 className={`${display} text-2xl`}>Shopping preferences</h2>
        <p className="text-sm text-mute">Optional. Your requests take priority, and liked looks help Gemi learn your style.</p>
        {([ ["gender", "Clothing department / gender", "e.g. menswear, womenswear, unisex"], ["size", "Sizes", "e.g. top M, waist 32, shoes US 10"], ["style", "Style", "e.g. minimalist, streetwear, modest"] ] as const).map(([key, label, placeholder]) => <label key={key} className="block text-sm font-medium">
          {label}<input value={prefs[key]} maxLength={200} placeholder={placeholder} onChange={(e) => setPrefs({ ...prefs, [key]: e.target.value })} className="mt-1 block w-full rounded-xl border border-line px-3 py-2" />
        </label>)}
        <button className={btn} disabled={saving}>{saving ? "Saving…" : "Save preferences"}</button>
      </form>
      <p role="status" aria-live="polite" className="mt-3 text-sm text-berry">{status}</p>
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
