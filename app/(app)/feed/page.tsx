"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setHandoff, loadSelfie, post, postJob, type FeedLook, type Look } from "@/lib/client";
import { describeLook, display, Icon, LookCard } from "../../ui";

export default function Community() {
  const router = useRouter();
  const [looks, setLooks] = useState<FeedLook[] | null>(null);
  const [sort, setSort] = useState<"for-you" | "trending" | "new">("for-you");
  const [busy, setBusy] = useState<number | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let live = true;
    const load = () =>
      fetch(`/api/looks?sort=${sort}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((rows: FeedLook[]) => live && setLooks(rows))
        .catch(() => live && setLooks((ls) => { if (!ls) setStatus("The feed did not load. Check your connection and reload the page."); return ls; }));
    load();
    // Re-read the feed so newly shared looks and likes appear without a reload.
    const timer = setInterval(() => { if (!document.hidden) load(); }, 15000);
    return () => { live = false; clearInterval(timer); };
  }, [sort]);

  async function tryOn(id: number) {
    const selfie = loadSelfie();
    if (!selfie) return setStatus("Add your photo in Chat or Profile first, then try the look on.");
    setBusy(id);
    setStatus("Dressing you in that look. This can take up to a minute.");
    try {
      setHandoff(await postJob<Look>(`/api/looks/${id}/tryon`, { selfie }));
      router.push("/studio");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Something went wrong. Try again.");
      setBusy(null);
    }
  }

  async function like(id: number) {
    try {
      const { liked } = await post<{ liked: boolean }>(`/api/looks/${id}/like`, {});
      setLooks((ls) => ls && ls.map((l) => (l.id === id ? { ...l, liked: true, likes: (l.likes ?? 0) + (liked ? 1 : 0) } : l)));
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "That like was not saved. Try again.");
    }
  }

  return (
    <main className="w-full px-4 py-8 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className={`${display} text-5xl`}>Community</h1>
        <div className="flex rounded-full bg-mist p-1" role="group" aria-label="Sort looks">
          {(["for-you", "trending", "new"] as const).map((s) => (
            <button key={s} aria-pressed={sort === s} onClick={() => setSort(s)}
              className="rounded-full px-5 py-2 text-sm font-semibold transition-colors aria-pressed:bg-white aria-pressed:shadow-sm">
              {s === "for-you" ? "For you" : s === "trending" ? "Trending" : "Newest"}
            </button>
          ))}
        </div>
      </div>
      <p role="status" aria-live="polite" className="min-h-6 py-2 text-sm font-medium text-berry">{status}</p>

      {looks?.length === 0 && <p className="py-16 text-center text-lg text-mute">Nobody has shared a look yet. Make one in Chat and share it.</p>}
      <div className="masonry columns-2 sm:columns-3 xl:columns-4 2xl:columns-5">
        {looks?.map((l) => (
          <LookCard key={l.id} author={l.author} total={l.total_usd}
            // eslint-disable-next-line @next/next/no-img-element -- served from our own DB route
            image={<img src={`/api/img/${l.id}`} alt={`Look by ${l.author}: ${describeLook(l.garments)}`} width={600} height={800} className="h-auto w-full" loading="lazy" />}>
            <button className="flex-1 rounded-full bg-white py-2 text-sm font-semibold transition-colors hover:bg-tag disabled:opacity-60" disabled={busy !== null} onClick={() => tryOn(l.id)}>
              {busy === l.id ? "Dressing you…" : "Try on me"}
            </button>
            <button className={`flex items-center gap-1 rounded-full bg-white px-3 py-2 text-sm font-semibold ${l.liked ? "text-berry" : ""}`}
              onClick={() => like(l.id)} aria-pressed={!!l.liked} aria-label={`Like this look. ${l.likes ?? 0} likes`}>
              <Icon name="heart" className="size-4" fill={!!l.liked} /> {l.likes ?? 0}
            </button>
          </LookCard>
        ))}
      </div>
    </main>
  );
}
