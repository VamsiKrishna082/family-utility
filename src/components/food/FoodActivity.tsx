"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ChevronLeft, ChevronRight, Home, Settings2 } from "lucide-react";
import { AddFoodSheet } from "@/components/food/AddFoodSheet";
import { EntrySheet } from "@/components/food/EntrySheet";
import { MovementSheet } from "@/components/food/MovementSheet";
import { SetupSheet } from "@/components/food/SetupSheet";
import { byMeal, fmt, Fortnight, Hero, Macros, MealCard, MealsSummary, Movement, Sheet, Week } from "@/components/food/parts";
import { getJson } from "@/components/food/api";
import { dateRange, shiftDate, todayIST } from "@/lib/fa/day";
import { FA_MEALS, FA_MEAL_LABEL, type FaDayResponse, type FaEntry, type FaMeal, type FaPersonDay } from "@/lib/fa/types";

const dayLabel = (date: string, today: string) =>
  date === today ? "Today" : date === shiftDate(today, -1) ? "Yesterday" : new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long" });
const longDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

/** Which meal "+ Log food" opens on, by the time of day in IST. */
function mealNow(): FaMeal {
  const h = Number(new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }));
  if (h < 11) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 19) return "snacks";
  return "dinner";
}

function showDinnerNudge(pd: FaPersonDay, isToday: boolean): boolean {
  if (!isToday || !pd.isYou || !pd.profile?.remindersOn) return false;
  const h = Number(new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }));
  return h >= 20 && !pd.entries.some((e) => e.meal === "dinner");
}

type Modal =
  | { kind: "add"; meal: FaMeal }
  | { kind: "entry"; entry: FaEntry }
  | { kind: "movement" }
  | { kind: "setup" }
  | { kind: "meal"; meal: FaMeal };

export function FoodActivity() {
  const today = todayIST();
  const [date, setDate] = useState(today);
  const [viewIdx, setViewIdx] = useState(0); // phone: 0 = you, 1 = the other person
  const [modal, setModal] = useState<Modal | null>(null);
  const { data, error, mutate, isLoading } = useSWR<FaDayResponse>(`/api/fa/day?date=${date}`, getJson, { keepPreviousData: true });

  const isToday = date === today;
  const close = () => setModal(null);
  const refresh = () => { mutate(); };

  if (error) {
    return <div className="fa fa-card" style={{ padding: 16, color: "#b44b44", fontSize: 14 }}>{error.message}</div>;
  }
  if (!data) {
    return <p className="fa" style={{ color: "var(--fa-dim)", fontSize: 14 }}>{isLoading ? "Loading…" : ""}</p>;
  }

  const me = data.people.find((p) => p.isYou)!;
  const other = data.people.find((p) => !p.isYou)!;
  const viewed = viewIdx === 0 ? me : other;
  const grouped = byMeal(viewed.entries);
  const strip = dateRange(today, 7);

  const dateNav = (
    <div className="flex items-center card" style={{ gap: 4, padding: 4, borderRadius: 14, border: "1px solid var(--fa-line)" }}>
      <button aria-label="Previous day" onClick={() => setDate(shiftDate(date, -1))} className="flex items-center justify-center" style={{ width: 44, height: 44, borderRadius: 10 }}><ChevronLeft size={20} /></button>
      <span style={{ minWidth: 150, textAlign: "center", fontWeight: 700, fontSize: 16 }}>{longDate(date)}</span>
      <button aria-label="Next day" disabled={isToday} onClick={() => setDate(shiftDate(date, 1))} className="flex items-center justify-center" style={{ width: 44, height: 44, borderRadius: 10, opacity: isToday ? 0.3 : 1 }}><ChevronRight size={20} /></button>
    </div>
  );

  return (
    <div className="fa">
      {/* ------------------------------ Phone ------------------------------ */}
      <div className="lg:hidden flex flex-col" style={{ gap: 16, paddingBottom: 96 }}>
        <header className="flex items-center justify-between" style={{ gap: 12 }}>
          <div className="flex flex-col" style={{ gap: 2 }}>
            <h1 className="fa-serif" style={{ margin: 0, fontSize: 26 }}>{dayLabel(date, today)}</h1>
            <span style={{ fontSize: 12, color: "var(--fa-dim)" }}>{longDate(date)}</span>
          </div>
          <div className="flex" style={{ gap: 2, padding: 3, borderRadius: 12, background: "#fff", border: "1px solid var(--fa-line)" }}>
            {[me, other].map((p, i) => (
              <button
                key={p.person.id}
                onClick={() => setViewIdx(i)}
                aria-pressed={viewIdx === i}
                style={{ height: 40, padding: "0 16px", borderRadius: 9, fontSize: 13, fontWeight: viewIdx === i ? 700 : 600, background: viewIdx === i ? "var(--fa-ink)" : "transparent", color: viewIdx === i ? "#fff" : "var(--fa-ink)" }}
              >
                {i === 0 ? "You" : p.person.name}
              </button>
            ))}
          </div>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6 }} role="tablist" aria-label="Pick a day">
          {strip.map((d) => {
            const on = d === date;
            return (
              <button
                key={d}
                role="tab"
                aria-selected={on}
                onClick={() => setDate(d)}
                className="flex flex-col items-center"
                style={{ gap: 2, padding: "8px 0", borderRadius: 12, border: `1px solid ${on ? "var(--fa-ink)" : "var(--fa-line)"}`, background: on ? "var(--fa-ink)" : "#fff", color: on ? "#fff" : "var(--fa-ink)" }}
              >
                <span style={{ fontSize: 11, opacity: 0.75 }}>{new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { weekday: "narrow" })}</span>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{Number(d.slice(8))}</span>
              </button>
            );
          })}
        </div>
        {!strip.includes(date) && (
          <button className="fa-chip" style={{ alignSelf: "flex-start" }} onClick={() => setDate(today)}>Back to today</button>
        )}

        {showDinnerNudge(viewed, isToday) && (
          <button onClick={() => setModal({ kind: "add", meal: "dinner" })} className="fa-card flex items-center justify-between" style={{ padding: "12px 16px", fontSize: 14, fontWeight: 600 }}>
            Log dinner? <span style={{ color: "var(--fa-accent)" }}>Add</span>
          </button>
        )}

        <Hero pd={viewed} isToday={isToday} onSetup={viewed.isYou ? () => setModal({ kind: "setup" }) : undefined} />
        <Macros pd={viewed} />

        <section className="flex flex-col" style={{ gap: 12 }}>
          {FA_MEALS.map((m) => (
            <MealCard
              key={m}
              meal={m}
              items={grouped[m]}
              editable={viewed.isYou}
              onAdd={() => setModal({ kind: "add", meal: m })}
              onItem={(entry) => setModal({ kind: "entry", entry })}
            />
          ))}
        </section>

        <Movement pd={viewed} editable={viewed.isYou} onEdit={() => setModal({ kind: "movement" })} />
        <Week pd={viewed} />

        {viewed.isYou && (
          <button onClick={() => setModal({ kind: "setup" })} className="fa-btn flex items-center justify-center" style={{ gap: 6 }}>
            <Settings2 size={15} /> Targets &amp; weight
          </button>
        )}

        {viewed.isYou && (
          <button
            onClick={() => setModal({ kind: "add", meal: isToday ? mealNow() : "lunch" })}
            className="fixed flex items-center"
            style={{ right: 16, bottom: 28, zIndex: 40, height: 56, padding: "0 24px", borderRadius: 18, background: "var(--fa-accent)", color: "#fff", fontSize: 16, fontWeight: 700, boxShadow: "0 6px 18px rgba(31,29,26,.18)" }}
          >
            + Log food
          </button>
        )}
      </div>

      {/* ----------------------------- Desktop ----------------------------- */}
      <div className="hidden lg:flex flex-col" style={{ gap: 22 }}>
        <header className="flex items-center justify-between" style={{ gap: 24 }}>
          <div className="flex items-center" style={{ gap: 16 }}>
            <Link href="/" aria-label="Back to home" className="flex items-center justify-center" style={{ width: 44, height: 44, borderRadius: 12, border: "1px solid var(--fa-line)", background: "#fff" }}>
              <Home size={20} />
            </Link>
            <h1 className="fa-serif" style={{ margin: 0, fontSize: 40, letterSpacing: -0.5 }}>Food &amp; activity</h1>
          </div>
          <div className="flex items-center" style={{ gap: 12 }}>
            {dateNav}
            <button className="fa-btn" style={{ height: 52 }} onClick={() => setModal({ kind: "setup" })} aria-label="Targets and weight"><Settings2 size={18} /></button>
            <button className="fa-btn fa-btn-primary" style={{ height: 52, padding: "0 22px", fontSize: 15 }} onClick={() => setModal({ kind: "add", meal: isToday ? mealNow() : "lunch" })}>
              + Log food
            </button>
          </div>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 20, alignItems: "start" }}>
          {[me, other].map((pd) => (
            <div key={pd.person.id} className="flex flex-col" style={{ gap: 16 }}>
              <Hero
                pd={pd}
                isToday={isToday}
                wide
                title={<span className="fa-serif" style={{ fontSize: 24 }}>{pd.isYou ? "You" : pd.person.name}</span>}
                onSetup={pd.isYou ? () => setModal({ kind: "setup" }) : undefined}
              />
              <Macros pd={pd} wide />
              <MealsSummary entries={pd.entries} onMeal={pd.isYou ? (meal) => setModal({ kind: "meal", meal }) : undefined} />
              {pd.isYou && (
                <button className="fa-btn" onClick={() => setModal({ kind: "movement" })}>
                  Movement · {fmt(pd.day?.steps ?? 0)} steps · {pd.day?.workoutMin ?? 0} min — edit
                </button>
              )}
              <Fortnight pd={pd} />
            </div>
          ))}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
          {[
            {
              title: "Logged together",
              value: `${data.loggedTogetherStreak} ${data.loggedTogetherStreak === 1 ? "day" : "days"} running`,
              note: data.loggedTogetherStreak ? "Both of you logged each of these days" : "Days when you both log show up here",
            },
            {
              title: "Average protein",
              value: `${me.avgProtein7} g / ${other.avgProtein7} g`,
              note: `You / ${other.person.name}, last 7 logged days`,
            },
            {
              title: "Steps this week",
              value: `${fmt(me.stepsWeek)} / ${fmt(other.stepsWeek)}`,
              note: `You / ${other.person.name} · goal ${fmt((me.profile?.stepGoal ?? 10000) * 7)} / ${fmt((other.profile?.stepGoal ?? 10000) * 7)}`,
            },
          ].map((s) => (
            <div key={s.title} className="fa-card flex flex-col" style={{ padding: 22, gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fa-dim)" }}>{s.title}</span>
              <span className="fa-serif" style={{ fontSize: 28 }}>{s.value}</span>
              <span style={{ fontSize: 13, color: "var(--fa-dim)" }}>{s.note}</span>
            </div>
          ))}
        </section>
      </div>

      {/* ------------------------------ Sheets ----------------------------- */}
      {modal?.kind === "add" && (
        <AddFoodSheet date={date} initialMeal={modal.meal} aiEnabled={data.aiEnabled} onClose={close} onAdded={refresh} />
      )}
      {modal?.kind === "entry" && <EntrySheet entry={modal.entry} onClose={close} onChanged={refresh} />}
      {modal?.kind === "movement" && <MovementSheet pd={me} date={date} onClose={close} onSaved={refresh} />}
      {modal?.kind === "setup" && <SetupSheet pd={me} date={date} onClose={close} onSaved={refresh} />}
      {modal?.kind === "meal" && (
        <Sheet onClose={close} label={FA_MEAL_LABEL[modal.meal]}>
          <MealCard
            meal={modal.meal}
            items={byMeal(me.entries)[modal.meal]}
            editable
            onAdd={() => setModal({ kind: "add", meal: modal.meal })}
            onItem={(entry) => setModal({ kind: "entry", entry })}
          />
        </Sheet>
      )}
    </div>
  );
}
