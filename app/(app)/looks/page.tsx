"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { post, type FeedLook } from "@/lib/client";
import { btn, describeLook, display, Icon, LookCard } from "../../ui";

export default function MyLooks() {
  const [looks, setLooks] = useState<FeedLook[] | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch("/api/looks?mine=1")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setLooks)
      .catch(() => setStatus("Your looks did not load. Check your connection and reload the page."));
  }, []);

  async function share(id: number) {
    try {
      await post("/api/looks", { id });
      setLooks((ls) => ls && ls.map((l) => (l.id === id ? { ...l, shared: true } : l)));
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "That look could not be shared. Try again.");
    }
  }

  return (
    <main className="w-full px-4 py-8 md:px-8">
      <h1 className={`${display} text-5xl`}>My looks</h1>
      <p className="mt-2 text-mute">Every look Gemi makes for you is saved here. Only the ones you share appear in the community.</p>
      <p role="status" aria-live="polite" className="min-h-6 py-2 text-sm font-medium text-berry">{status}</p>

      {looks?.length === 0 && (
        <div className="mx-auto max-w-sm py-16 text-center">
          <p className="text-lg text-mute">You have not made a look yet.</p>
          <Link href="/studio" className={`${btn} mt-5`}><Icon name="chat" /> Make your first look</Link>
        </div>
      )}
      <div className="masonry columns-2 sm:columns-3 xl:columns-4 2xl:columns-5">
        {looks?.map((l) => (
          <LookCard key={l.id} total={l.total_usd} badge={l.shared ? "Shared" : "Private"}
            author={l.shared ? `${l.likes ?? 0} likes, ${l.tryons ?? 0} try-ons` : undefined}
            // eslint-disable-next-line @next/next/no-img-element -- served from our own DB route
            image={<img src={`/api/img/${l.id}`} alt={`You wearing ${describeLook(l.garments)}`} width={600} height={800} className="h-auto w-full" loading="lazy" />}>
            <a className="grid size-9 shrink-0 place-items-center rounded-full bg-white transition-colors hover:bg-tag" href={`/api/img/${l.id}?download`} download aria-label="Download this picture" title="Download">
              <Icon name="download" className="size-4" />
            </a>
            {!l.shared && (
              <button className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white py-2 text-sm font-semibold transition-colors hover:bg-tag" onClick={() => share(l.id)}>
                <Icon name="share" className="size-4" /> Share to community
              </button>
            )}
          </LookCard>
        ))}
      </div>
    </main>
  );
}
