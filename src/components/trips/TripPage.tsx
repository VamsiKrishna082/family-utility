"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, MapPin, Pencil, Share2, Trash2, Users } from "lucide-react";
import { rangeLabel, todayIST, tripStatus, tripWhen } from "@/lib/trips/logic";
import { ExpensesTab } from "@/components/trips/ExpensesTab";
import { JourneyTab } from "@/components/trips/JourneyTab";
import { PlanTab } from "@/components/trips/PlanTab";
import { ShareSheet } from "@/components/trips/ShareSheet";
import { TripForm } from "@/components/trips/TripForm";
import { useTrip } from "@/components/trips/useTrip";
import { Cover, Modal, send, StatusPill } from "@/components/trips/shared";

type Tab = "plan" | "journey" | "expenses";

export function TripPage({ id }: { id: string }) {
  const router = useRouter();
  const { data, error, mutate, saveTrip } = useTrip(id);
  const [tab, setTab] = useState<Tab | null>(null);
  const [editing, setEditing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const today = todayIST();

  if (error) return <div className="card" style={{ padding: 16, color: "var(--red)", fontSize: 14 }}>{error.message} · <Link href="/trips" style={{ color: "var(--indigo)" }}>All trips</Link></div>;
  if (!data) return <p style={{ color: "var(--faint)", fontSize: 14 }}>Loading…</p>;

  const { trip, days, hiddenDays } = data;
  const status = tripStatus(trip.startDate, trip.endDate, today);
  // Open where it's useful: planning before the trip, the journal during/after.
  const active: Tab = tab ?? (status === "ongoing" || status === "completed" ? "journey" : "plan");

  const del = async () => {
    await send(`/api/trips/${id}`, "DELETE");
    router.push("/trips");
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/trips" className="flex items-center justify-center shrink-0 card" style={{ width: 38, height: 38, borderRadius: 12 }} aria-label="All trips">
          <ChevronLeft size={19} />
        </Link>
        <span style={{ fontSize: 13.5, color: "var(--faint)" }}>Trips</span>
        <div className="flex items-center gap-2" style={{ marginLeft: "auto" }}>
          <button className="btn btn-plain flex items-center gap-1.5" onClick={() => setSharing(true)}><Share2 size={14} /> <span className="hidden sm:inline">Share & print</span></button>
          <button className="btn btn-plain flex items-center gap-1.5" onClick={() => setEditing(true)}><Pencil size={14} /> <span className="hidden sm:inline">Edit</span></button>
        </div>
      </div>

      <Cover photoId={trip.coverPhotoId} height={220} radius={18}>
        <div style={{ position: "absolute", inset: 0, background: trip.coverPhotoId ? "linear-gradient(to top, rgba(0,0,0,.6), rgba(0,0,0,0) 60%)" : "none" }} />
        <div style={{ position: "absolute", left: 20, right: 20, bottom: 18, color: trip.coverPhotoId ? "#fff" : "var(--ink)" }}>
          <div className="flex items-center gap-2 mb-1"><StatusPill status={status} /><span style={{ fontSize: 13, fontWeight: 700 }}>{tripWhen(trip.startDate, trip.endDate, trip.days, today)}</span></div>
          <h1 className="display" style={{ fontSize: 32, lineHeight: 1.1 }}>{trip.name}</h1>
          <p className="flex flex-wrap items-center" style={{ gap: 10, fontSize: 13.5, marginTop: 4, opacity: 0.9 }}>
            {trip.destination && <span className="flex items-center gap-1"><MapPin size={13} /> {trip.destination}</span>}
            <span>{trip.startDate && trip.endDate ? rangeLabel(trip.startDate, trip.endDate) : "No dates yet"} · {trip.days} day{trip.days === 1 ? "" : "s"}</span>
            {trip.travellers.length > 0 && <span className="flex items-center gap-1"><Users size={13} /> {trip.travellers.join(", ")}</span>}
          </p>
        </div>
      </Cover>
      {!trip.coverPhotoId && <p style={{ fontSize: 12, color: "var(--faint)", marginTop: 6 }}>Tip: on the Journey tab, tap the ☆ on any day photo to make it the cover.</p>}
      {trip.notes && <p className="card mt-4" style={{ padding: 14, fontSize: 14, whiteSpace: "pre-wrap" }}>{trip.notes}</p>}

      <div className="flex my-5" style={{ gap: 4, padding: 4, borderRadius: 12, background: "var(--card)", border: "1px solid var(--line)", width: "fit-content" }} role="tablist">
        {(["plan", "journey", "expenses"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={active === t}
            onClick={() => setTab(t)}
            style={{ padding: "8px 16px", borderRadius: 9, fontSize: 13.5, fontWeight: 600, background: active === t ? "var(--ink)" : "transparent", color: active === t ? "#fff" : "var(--dim)" }}
          >
            {t === "plan" ? "Plan" : t === "journey" ? "Journey" : "Expenses"}
          </button>
        ))}
      </div>

      {active === "plan" && <PlanTab trip={trip} saveTrip={saveTrip} />}
      {active === "journey" && <JourneyTab trip={trip} days={days} hiddenDays={hiddenDays} onChanged={() => mutate()} saveTrip={saveTrip} />}
      {active === "expenses" && <ExpensesTab trip={trip} saveTrip={saveTrip} />}

      <div className="flex justify-end mt-8">
        <button className="flex items-center gap-1.5" style={{ fontSize: 13, color: "var(--faint)" }} onClick={() => setDeleting(true)}><Trash2 size={14} /> Delete trip</button>
      </div>

      {editing && <TripForm editing={trip} onClose={() => setEditing(false)} onSaved={() => mutate()} />}
      {sharing && <ShareSheet trip={trip} onClose={() => setSharing(false)} onChanged={() => mutate()} />}
      {deleting && (
        <Modal title="Delete this trip?" onClose={() => setDeleting(false)}>
          <p style={{ fontSize: 14, color: "var(--dim)" }}>
            “{trip.name}” and its plan and journal will be deleted. Its expenses stay in Money (just no longer tied to this trip), and its photos stay in the Album.
          </p>
          <div className="flex mt-4" style={{ gap: 8 }}>
            <button className="btn btn-plain flex-1" onClick={() => setDeleting(false)}>Keep it</button>
            <button className="btn flex-1" style={{ background: "var(--red)", color: "#fff" }} onClick={del}>Delete trip</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
