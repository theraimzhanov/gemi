"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setHandoff, loadSelfie, post, type FeedLook, type Look } from "@/lib/client";
import { btnGhost, Header, LookCard } from "../ui";

export default function Feed() {
  const router = useRouter();
  const [looks, setLooks] = useState<FeedLook[]>([]);
  const [sort, setSort] = useState<"trending" | "new">("trending");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Loading…");

  useEffect(() => {
    let live = true;
    fetch(`/api/looks?sort=${sort}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((rows: FeedLook[]) => {
        if (!live) return;
        setLooks(rows);
        setStatus(rows.length ? "" : "No looks yet. Create one in the Studio and share it.");
      })
      .catch(() => live && setStatus("Couldn't load the feed. Check the database connection."));
    return () => { live = false; };
  }, [sort]);

  async function tryOn(id: number) {
    const selfie = loadSelfie();
    if (!selfie) return setStatus("Add your photo in the Studio first, then come back.");
    setBusy(true);
    setStatus("Dressing you in that look… this can take up to a minute.");
    try {
      setHandoff(await post<Look>(`/api/looks/${id}/tryon`, { selfie }));
      router.push("/");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  async function like(id: number) {
    try {
      await post(`/api/looks/${id}/like`, {});
      setLooks((ls) => ls.map((l) => (l.id === id ? { ...l, likes: (l.likes ?? 0) + 1 } : l)));
    } catch {
      setStatus("Couldn't save that like.");
    }
  }

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-5xl space-y-4 p-4">
        <div className="flex items-center gap-2">
          <h1 className="mr-auto text-3xl font-semibold tracking-tight">Community looks</h1>
          {(["trending", "new"] as const).map((s) => (
            <button key={s} className={btnGhost} aria-pressed={sort === s} onClick={() => setSort(s)}>
              {s === "trending" ? "Trending" : "Newest"}
            </button>
          ))}
        </div>
        <p role="status" aria-live="polite" className="min-h-5 text-sm text-fuchsia-300">{status}</p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {looks.map((l) => <LookCard key={l.id} look={l} busy={busy} onTry={() => tryOn(l.id)} onLike={() => like(l.id)} />)}
        </div>
      </main>
    </>
  );
}
