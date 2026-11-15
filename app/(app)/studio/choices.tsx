"use client";
import { useState } from "react";
import { cheapestSelection, selectCandidates, type Shopping } from "@/lib/styling";
import { src } from "@/lib/client";
import { btn, money } from "../../ui";

export function Choices({ shopping, busy, onConfirm }: {
  shopping: Shopping & { job: number }; busy: boolean; onConfirm: (indices: number[]) => void;
}) {
  const [selected, setSelected] = useState(() => cheapestSelection(shopping));
  let error = "";
  try { selectCandidates(shopping, selected); } catch (e) { error = (e as Error).message; }
  const total = selected.reduce((sum, i) => sum + Math.round((shopping.candidates[i]?.garment.price_usd ?? 0) * 100), 0) / 100;
  return <div className="space-y-4 rounded-3xl border border-line p-4">
    {shopping.categories.map((category, group) => <fieldset key={category} disabled={busy}>
      <legend className="mb-2 font-semibold capitalize">{category}</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        {shopping.candidates.map((candidate, i) => candidate.garment.category === category && <label key={i} className={`flex cursor-pointer flex-col gap-2 rounded-2xl border p-3 ${selected[group] === i ? "border-berry bg-mist" : "border-line"}`}>
          {candidate.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src(candidate.image)} alt={candidate.garment.description} className="h-36 w-full rounded-xl object-contain" />
          ) : <span className="grid h-36 place-items-center rounded-xl bg-mist text-sm text-mute">Photo unavailable</span>}
          <span className="flex items-start gap-2 text-sm font-medium">
            <input type="radio" name={`shopping-${shopping.job}-${category}`} checked={selected[group] === i} onChange={() => setSelected((s) => s.map((value, index) => index === group ? i : value))} />
            {candidate.garment.description}
          </span>
          <span className="text-sm">{money(candidate.garment.price_usd)}</span>
          <a href={candidate.garment.url} target="_blank" rel="noopener noreferrer" className="mt-auto text-sm underline">View at store</a>
        </label>)}
      </div>
    </fieldset>)}
    <p className="font-semibold">Selected items: {money(total)}{shopping.budget !== undefined && ` / ${money(shopping.budget)} budget`}</p>
    <p className="text-xs text-mute">Before tax and shipping. Check current price, size and stock at the store.</p>
    {error && <p role="status" className="text-sm text-berry">{error}</p>}
    <button className={btn} disabled={busy || !!error} onClick={() => onConfirm(selected)}>Try these on</button>
  </div>;
}
