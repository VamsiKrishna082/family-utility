"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { ExternalLink, Plus, Sparkles, ThumbsUp } from "lucide-react";
import { safeUrl } from "@/lib/trips/logic";
import { FA_PEOPLE } from "@/lib/fa/people";
import type { Trip, TripIdea, TripIdeasResponse } from "@/lib/trips/types";
import { FieldForm, num, str, type Field } from "@/components/trips/FieldForm";
import { fetcher, rupees, send } from "@/components/trips/shared";

const FIELDS: Field[] = [
  { key: "place", label: "Where", type: "text", required: true, placeholder: "e.g. Spiti Valley" },
  { key: "why", label: "Why", type: "textarea", placeholder: "Monasteries, stars, the drive…" },
  { key: "bestSeason", label: "Best season", type: "text", placeholder: "e.g. June–September" },
  { key: "days", label: "How many days", type: "number" },
  { key: "roughCostRupees", label: "Rough cost for both (₹)", type: "number" },
  { key: "link", label: "Link", type: "url", placeholder: "A blog or itinerary you liked" },
];

/**
 * "Someday places" — not trips yet. Both of you can 👍 them; the most wanted
 * float to the top. "Make it a trip" creates the trip (as an idea you can
 * then date and plan) and removes it from here.
 */
export function IdeasBoard() {
  const router = useRouter();
  const { data, mutate } = useSWR<TripIdeasResponse>("/api/trip-ideas", fetcher);
  const [form, setForm] = useState<{ id?: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const ideas = data?.items ?? [];
  const me = data?.me;
  const editing = form?.id ? ideas.find((i) => i.id === form.id) : undefined;

  const toBody = (v: Record<string, string>) => ({ place: v.place, why: str(v.why), bestSeason: str(v.bestSeason), days: num(v.days), roughCostRupees: num(v.roughCostRupees), link: str(v.link) });

  const vote = async (idea: TripIdea) => {
    if (!me) return;
    const votes = idea.votes?.includes(me.id) ? idea.votes.filter((v) => v !== me.id) : [...(idea.votes ?? []), me.id];
    await mutate({ ...data!, items: ideas.map((i) => (i.id === idea.id ? { ...i, votes } : i)) }, false);
    await send(`/api/trip-ideas/${idea.id}`, "PATCH", { votes });
    mutate();
  };

  const makeTrip = async (idea: TripIdea) => {
    setBusy(idea.id);
    try {
      const { trip } = await send<{ trip: Trip }>("/api/trips", "POST", {
        name: idea.place, destination: idea.place, days: idea.days ?? 3,
        ...(idea.roughCostRupees ? { budgetRupees: idea.roughCostRupees } : {}),
        notes: [idea.why, idea.bestSeason ? `Best season: ${idea.bestSeason}` : ""].filter(Boolean).join("\n"),
        links: safeUrl(idea.link) ? [{ id: "l0", title: `${idea.place} — saved idea`, url: idea.link! }] : [],
      });
      await send(`/api/trip-ideas/${idea.id}`, "DELETE");
      router.push(`/trips/${trip.id}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <p className="flex items-center" style={{ gap: 6, fontSize: 12.5, color: "var(--faint)", fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>
          <Sparkles size={13} /> Someday places
        </p>
        <button className="btn btn-plain flex items-center gap-1" style={{ padding: "6px 10px", fontSize: 12.5 }} onClick={() => setForm({})}><Plus size={13} /> Add a place</button>
      </div>
      {!ideas.length ? (
        <p className="card" style={{ padding: 14, fontSize: 13.5, color: "var(--faint)" }}>Places you&apos;d love to go one day — with the best season and a rough cost. 👍 each other&apos;s, and turn one into a trip when it&apos;s time.</p>
      ) : (
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
          {ideas.map((idea) => {
            const mine = me && idea.votes?.includes(me.id);
            return (
              <div key={idea.id} className="card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                <div className="flex items-start justify-between" style={{ gap: 8 }}>
                  <button className="text-left" onClick={() => setForm({ id: idea.id })}><p className="display" style={{ fontSize: 18 }}>{idea.place}</p></button>
                  <button onClick={() => vote(idea)} className="flex items-center" style={{ gap: 3, fontSize: 12, fontWeight: 700, color: mine ? "#2f6e6b" : "var(--faint)" }} title={idea.votes?.length ? `Liked by ${idea.votes.map((v) => FA_PEOPLE.find((p) => p.id === v)?.name ?? v).join(" & ")}` : "Like"} aria-pressed={!!mine}>
                    <ThumbsUp size={14} fill={mine ? "#2f6e6b" : "none"} /> {idea.votes?.length || ""}
                  </button>
                </div>
                {idea.why && <p style={{ fontSize: 13, color: "var(--dim)" }}>{idea.why}</p>}
                <p style={{ fontSize: 12.5, color: "var(--faint)" }}>
                  {[idea.bestSeason && `Best: ${idea.bestSeason}`, idea.days && `${idea.days} days`, idea.roughCostRupees && `~${rupees(idea.roughCostRupees)}`].filter(Boolean).join(" · ")}
                </p>
                <div className="flex items-center justify-between mt-1">
                  {safeUrl(idea.link) ? <a href={safeUrl(idea.link)} target="_blank" rel="noreferrer" className="flex items-center" style={{ gap: 4, fontSize: 12.5, color: "var(--indigo)", fontWeight: 600 }}>Link <ExternalLink size={11} /></a> : <span />}
                  <button className="btn btn-plain" style={{ padding: "5px 10px", fontSize: 12.5 }} disabled={busy === idea.id} onClick={() => makeTrip(idea)}>{busy === idea.id ? "Creating…" : "Make it a trip"}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {form && (
        <FieldForm
          title={editing ? "Edit place" : "Someday place"}
          fields={FIELDS}
          initial={editing ? Object.fromEntries(Object.entries(editing).filter(([k, v]) => FIELDS.some((f) => f.key === k) && v !== undefined).map(([k, v]) => [k, String(v)])) : undefined}
          onClose={() => setForm(null)}
          onSubmit={async (v) => {
            if (editing) await send(`/api/trip-ideas/${editing.id}`, "PATCH", toBody(v));
            else await send("/api/trip-ideas", "POST", toBody(v));
            mutate();
          }}
          onDelete={editing ? async () => { await send(`/api/trip-ideas/${editing.id}`, "DELETE"); mutate(); } : undefined}
        />
      )}
    </section>
  );
}
