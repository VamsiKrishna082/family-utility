"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { ChevronLeft, ScanBarcode, Star, Minus, Plus, Camera, Sparkles, Loader2 } from "lucide-react";
import { BarcodeScanner } from "@/components/food/BarcodeScanner";
import { fmt, Sheet } from "@/components/food/parts";
import { fileToJpegBase64, getJson, send } from "@/components/food/api";
import { scaleNutrition } from "@/lib/fa/day";
import {
  FA_MEALS, FA_MEAL_LABEL, FA_NUTRIENTS, FA_SOURCES, FA_SOURCE_LABEL,
  type FaFood, type FaMeal, type FaNutrient, type FaNutrition, type FaQuickResponse, type FaSearchResponse, type FaSource,
} from "@/lib/fa/types";

const FIELD: Record<FaNutrient, { label: string; unit: string }> = {
  kcal: { label: "Calories", unit: "kcal" },
  protein: { label: "Protein", unit: "g" },
  carbs: { label: "Carbs", unit: "g" },
  fat: { label: "Fat", unit: "g" },
  fibre: { label: "Fibre", unit: "g" },
};

type Fields = Record<FaNutrient, string>;
const toFields = (n: FaNutrition): Fields => ({
  kcal: String(Math.round(n.kcal)), protein: String(n.protein), carbs: String(n.carbs), fat: String(n.fat), fibre: String(n.fibre),
});
const fromFields = (f: Fields): FaNutrition => {
  const v = (s: string) => Math.max(0, Number(s) || 0);
  return { kcal: v(f.kcal), protein: v(f.protein), carbs: v(f.carbs), fat: v(f.fat), fibre: v(f.fibre) };
};
const divide = (n: FaNutrition, by: number): FaNutrition => scaleNutrition(n, 1 / by);

/** The original source of a food, from its key — "your version" rows carry the key of what they override. */
const sourceOfKey = (key: string): FaSource => {
  const p = key.split(":")[0] as FaSource;
  return (FA_SOURCES as readonly string[]).includes(p) ? p : "yours";
};

function SourceBadge({ food }: { food: FaFood }) {
  const yours = food.source === "yours";
  const label = food.source === "off" && food.barcode ? "Barcode" : FA_SOURCE_LABEL[food.source];
  return (
    <span style={{ padding: "5px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, flexShrink: 0, background: yours ? "var(--fa-accent-soft)" : "var(--fa-line2)", color: yours ? "var(--fa-accent)" : "var(--fa-dim)" }}>
      {label}
    </span>
  );
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function AddFoodSheet({
  date, initialMeal, aiEnabled, onClose, onAdded,
}: {
  date: string;
  initialMeal: FaMeal;
  aiEnabled: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [meal, setMeal] = useState<FaMeal>(initialMeal);
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim(), 300);
  const [barcodeResults, setBarcodeResults] = useState<FaFood[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [selected, setSelected] = useState<FaFood | null>(null);
  const [servingIdx, setServingIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [fields, setFields] = useState<Fields | null>(null);
  const [edited, setEdited] = useState(false);
  const [resetToSource, setResetToSource] = useState(false);
  const [favourite, setFavourite] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [custom, setCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customServing, setCustomServing] = useState("1 serving");
  const photoRef = useRef<HTMLInputElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const { data: search, isLoading: searching } = useSWR<FaSearchResponse>(
    dq.length >= 2 && !barcodeResults ? `/api/fa/foods/search?q=${encodeURIComponent(dq)}` : null,
    getJson,
    { keepPreviousData: true },
  );
  const { data: quick } = useSWR<FaQuickResponse>(`/api/fa/quick?date=${date}&meal=${meal}`, getJson);
  const results = barcodeResults ?? (dq.length >= 2 ? search?.results ?? [] : []);

  const serving = selected?.servings[servingIdx] ?? selected?.servings[0];
  const perServing = fields ? fromFields(fields) : null;
  const total = perServing ? scaleNutrition(perServing, qty) : null;

  const select = (food: FaFood) => {
    setSelected(food);
    setServingIdx(0);
    setQty(1);
    setFields(toFields(scaleNutrition(food.base, food.servings[0]?.mult ?? 1)));
    setEdited(false);
    setResetToSource(false);
    setFavourite(Boolean(food.favourite));
    setCustom(false);
    setError("");
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const pickServing = (i: number) => {
    if (!selected) return;
    const prevMult = serving?.mult ?? 1;
    const nextMult = selected.servings[i].mult;
    setServingIdx(i);
    // Keep any edits, rescaled to the new serving size.
    const base = perServing ? divide(perServing, prevMult) : selected.base;
    setFields(toFields(scaleNutrition(base, nextMult)));
  };

  const reset = () => {
    if (!selected) return;
    const src = selected.sourceBase ?? selected.base;
    setFields(toFields(scaleNutrition(src, serving?.mult ?? 1)));
    setEdited(false);
    setResetToSource(Boolean(selected.sourceBase));
  };

  const finish = () => {
    onAdded();
    onClose();
  };

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  const add = () => run("add", async () => {
    if (!selected || !perServing || !total || !serving) return;
    let food = selected;
    let overrideBase = edited ? divide(perServing, serving.mult) : undefined;
    // A "your version" row: always send the original food, plus your numbers
    // (or none, after Reset), so the override keeps pointing at its source.
    if (selected.sourceBase) {
      food = { ...selected, name: selected.name.replace(/ — your version$/, ""), base: selected.sourceBase, source: sourceOfKey(selected.key) };
      if (resetToSource) {
        await send(`/api/fa/foods/override?key=${encodeURIComponent(selected.key)}`, "DELETE");
        overrideBase = undefined;
      } else if (!overrideBase) {
        overrideBase = selected.base;
      }
    }
    await send("/api/fa/entries", "POST", {
      date, meal, qty,
      food: { key: food.key, name: food.name, brand: food.brand, barcode: food.barcode, source: food.source, baseLabel: food.baseLabel, base: food.base, servings: food.servings, confidence: food.confidence },
      servingLabel: serving.label,
      nutrition: total,
      overrideBase,
    });
    finish();
  });

  const addCustom = () => run("add", async () => {
    if (!perServing || !customName.trim()) return;
    const key = `yours:${customName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    await send("/api/fa/entries", "POST", {
      date, meal, qty,
      food: { key, name: customName.trim(), source: "yours", baseLabel: customServing || "1 serving", base: perServing, servings: [{ label: customServing || "1 serving", mult: 1 }] },
      servingLabel: customServing || "1 serving",
      nutrition: scaleNutrition(perServing, qty),
      overrideBase: perServing,
    });
    finish();
  });

  const toggleFavourite = () => run("fav", async () => {
    if (!selected) return;
    const next = !favourite;
    setFavourite(next);
    await send("/api/fa/foods/favourite", "PUT", {
      on: next,
      food: { key: selected.key, name: selected.name.replace(/ — your version$/, ""), brand: selected.brand, barcode: selected.barcode, source: sourceOfKey(selected.key), baseLabel: selected.baseLabel, base: selected.sourceBase ?? selected.base, servings: selected.servings },
    });
  });

  const repeat = () => run("repeat", async () => {
    if (!quick?.repeat) return;
    await send("/api/fa/entries/repeat", "POST", { fromDate: quick.repeat.fromDate, meal: quick.repeat.meal, toDate: date, toMeal: meal });
    finish();
  });

  const addFrequent = (i: number) => run(`freq${i}`, async () => {
    const e = quick?.frequent[i]?.entry;
    if (!e) return;
    const unit = divide({ kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat, fibre: e.fibre }, e.qty);
    await send("/api/fa/entries", "POST", {
      date, meal, qty: e.qty,
      food: { key: e.foodKey, name: e.name, source: e.source, baseLabel: e.servingLabel, base: unit, servings: [{ label: e.servingLabel, mult: 1 }] },
      servingLabel: e.servingLabel,
      nutrition: { kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat, fibre: e.fibre },
    });
    finish();
  });

  const estimate = (body: { text?: string; image?: { data: string; mediaType: string } }) => run("ai", async () => {
    const { food } = await send<{ food: FaFood }>("/api/fa/foods/estimate", "POST", body);
    select(food);
  });

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      estimate({ image: await fileToJpegBase64(file) });
    } catch {
      setError("Couldn't read that photo");
    }
  };

  const onBarcode = (code: string) => {
    setScanning(false);
    run("barcode", async () => {
      const res = await getJson<FaSearchResponse>(`/api/fa/foods/search?barcode=${code}`);
      if (!res.results.length) {
        setBarcodeResults([]);
        setError(`No product found for ${code}. Search by name or enter it yourself.`);
        return;
      }
      setBarcodeResults(res.results);
      select(res.results[0]);
    });
  };

  const startCustom = () => {
    setSelected(null);
    setCustom(true);
    setCustomName(q.trim());
    setFields({ kcal: "", protein: "", carbs: "", fat: "", fibre: "" });
    setQty(1);
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const showQuick = !q.trim() && !barcodeResults;
  const chips = useMemo(() => quick?.favourites ?? [], [quick]);

  return (
    <Sheet onClose={onClose} label={`Add to ${FA_MEAL_LABEL[meal]}`} full>
      <div className="flex flex-col" style={{ gap: 16 }}>
        <header className="flex items-center" style={{ gap: 12 }}>
          <button onClick={onClose} aria-label="Back" className="flex items-center justify-center" style={{ width: 44, height: 44, borderRadius: 12, border: "1px solid var(--fa-line)", background: "#fff", flexShrink: 0 }}>
            <ChevronLeft size={20} />
          </button>
          <h1 className="fa-serif" style={{ margin: 0, fontSize: 24 }}>Add to {FA_MEAL_LABEL[meal].toLowerCase()}</h1>
        </header>

        <div className="flex overflow-x-auto" style={{ gap: 8, margin: "0 -16px", padding: "0 16px" }}>
          {FA_MEALS.map((m) => (
            <button key={m} className="fa-chip" aria-pressed={m === meal} onClick={() => setMeal(m)}>{FA_MEAL_LABEL[m]}</button>
          ))}
        </div>

        <div className="flex" style={{ gap: 8 }}>
          <input
            type="search"
            autoFocus
            aria-label="Search food"
            placeholder="Search idli, sambar, a brand…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setBarcodeResults(null); }}
            className="flex-1"
            style={{ height: 48, padding: "0 16px", borderRadius: 14, border: "1px solid var(--fa-line)", background: "#fff", fontSize: 15, outline: "none", minWidth: 0 }}
          />
          <button aria-label="Scan barcode" onClick={() => setScanning(true)} className="flex items-center justify-center" style={{ width: 48, height: 48, borderRadius: 14, border: "1px solid var(--fa-line)", background: "#fff", flexShrink: 0 }}>
            <ScanBarcode size={20} />
          </button>
        </div>

        {error && <p style={{ margin: 0, fontSize: 13, color: "#b44b44" }}>{error}</p>}
        {busy === "barcode" && <p className="flex items-center" style={{ margin: 0, gap: 6, fontSize: 13, color: "var(--fa-dim)" }}><Loader2 size={14} className="spin" /> Looking up barcode…</p>}

        {showQuick && (
          <section className="flex flex-col" style={{ gap: 8 }}>
            <span className="fa-label">Quick add</span>
            <div className="flex flex-wrap" style={{ gap: 8 }}>
              {quick?.repeat && (
                <button className="fa-chip" onClick={repeat} disabled={!!busy} title={`${quick.repeat.count} items · ${fmt(quick.repeat.kcal)} kcal`}>
                  {busy === "repeat" ? "Adding…" : `${quick.repeat.label} · ${fmt(quick.repeat.kcal)}`}
                </button>
              )}
              {quick?.frequent.map((f, i) => (
                <button key={f.label} className="fa-chip" onClick={() => addFrequent(i)} disabled={!!busy}>{busy === `freq${i}` ? "Adding…" : f.label}</button>
              ))}
              {chips.map((f) => (
                <button key={f.key} className="fa-chip flex items-center" style={{ gap: 6 }} onClick={() => select(f)}>
                  <Star size={13} fill="currentColor" /> {f.name}
                </button>
              ))}
              {aiEnabled && (
                <button className="fa-chip flex items-center" style={{ gap: 6 }} onClick={() => photoRef.current?.click()} disabled={!!busy}>
                  {busy === "ai" ? <Loader2 size={14} className="spin" /> : <Camera size={14} />} Photo estimate
                </button>
              )}
              <button className="fa-chip" onClick={startCustom}>Enter your own</button>
            </div>
            {!quick?.repeat && !quick?.frequent.length && !chips.length && (
              <p style={{ margin: 0, fontSize: 12, color: "var(--fa-dim)" }}>Search above — foods you log often, starred ones and yesterday&apos;s meals show up here to add in one tap.</p>
            )}
          </section>
        )}
        <input ref={photoRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />

        {!showQuick && (
          <section className="flex flex-col" style={{ gap: 8 }}>
            <span className="fa-label flex items-center" style={{ gap: 6 }}>
              Matches {searching && <Loader2 size={12} className="spin" />}
            </span>
            {results.map((r) => {
              const active = selected?.key === r.key && selected?.source === r.source;
              const s = r.servings[0];
              const meta = r.source === "yours" && r.editedAt
                ? `${s?.label ?? r.baseLabel} · ${fmt(r.base.kcal * (s?.mult ?? 1))} kcal · edited ${new Date(r.editedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                : `${r.brand ? `${r.brand} · ` : ""}${s?.label ?? r.baseLabel} · ${fmt(r.base.kcal * (s?.mult ?? 1))} kcal`;
              return (
                <button
                  key={`${r.source}:${r.key}`}
                  onClick={() => select(r)}
                  className="flex items-center justify-between text-left"
                  style={{ gap: 12, minHeight: 60, padding: "10px 14px", borderRadius: 14, background: "#fff", border: `1px solid ${active ? "var(--fa-ink)" : "var(--fa-line)"}` }}
                >
                  <span className="flex flex-col min-w-0" style={{ gap: 2 }}>
                    <span className="truncate" style={{ fontSize: 15, fontWeight: 600 }}>{r.name}</span>
                    <span className="truncate" style={{ fontSize: 12, color: "var(--fa-dim)" }}>{meta}</span>
                  </span>
                  <SourceBadge food={r} />
                </button>
              );
            })}
            {dq.length >= 2 && !searching && results.length === 0 && !barcodeResults && (
              <p style={{ margin: 0, fontSize: 13, color: "var(--fa-dim)" }}>No matches for “{dq}”.</p>
            )}
            <div className="flex flex-wrap" style={{ gap: 8 }}>
              {aiEnabled && q.trim().length >= 3 && (
                <button className="fa-chip flex items-center" style={{ gap: 6 }} onClick={() => estimate({ text: q.trim() })} disabled={!!busy}>
                  {busy === "ai" ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} Estimate “{q.trim()}”
                </button>
              )}
              <button className="fa-chip" onClick={startCustom}>Enter it yourself</button>
            </div>
          </section>
        )}

        {(selected || custom) && fields && (
          <section ref={detailRef} className="fa-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16, scrollMarginTop: 12 }}>
            {selected ? (
              <div className="flex justify-between items-baseline" style={{ gap: 10 }}>
                <h2 className="fa-serif" style={{ margin: 0, fontSize: 20 }}>{selected.name}</h2>
                <SourceBadge food={selected} />
              </div>
            ) : (
              <input className="fa-input" placeholder="Food name" value={customName} onChange={(e) => setCustomName(e.target.value)} aria-label="Food name" />
            )}
            {selected?.source === "ai" && (
              <p style={{ margin: 0, fontSize: 12, color: "var(--fa-dim)" }}>
                AI estimate{selected.confidence ? ` · ${selected.confidence} confidence` : ""}. Check the numbers — edit anything that looks off.
              </p>
            )}

            <div className="flex flex-col" style={{ gap: 8 }}>
              <span className="fa-label">Serving</span>
              {selected ? (
                <div className="flex flex-wrap" style={{ gap: 8 }}>
                  {selected.servings.map((s, i) => (
                    <button
                      key={s.label}
                      onClick={() => pickServing(i)}
                      style={{
                        flexGrow: 1, minHeight: 44, padding: "0 12px", borderRadius: 12, fontSize: 14, fontWeight: 600,
                        border: `1px solid ${i === servingIdx ? "var(--fa-ink)" : "var(--fa-line)"}`,
                        background: i === servingIdx ? "var(--fa-ink)" : "#fff",
                        color: i === servingIdx ? "#fff" : "var(--fa-ink)",
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              ) : (
                <input className="fa-input" value={customServing} onChange={(e) => setCustomServing(e.target.value)} aria-label="Serving" placeholder="e.g. 1 bowl" />
              )}
              <div className="flex items-center justify-between" style={{ marginTop: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>How many</span>
                <div className="flex items-center" style={{ gap: 6 }}>
                  <button className="fa-btn" aria-label="Fewer" onClick={() => setQty((n) => Math.max(0.5, n <= 1 ? n - 0.5 : n - 1))} style={{ width: 44, padding: 0 }}><Minus size={16} className="mx-auto" /></button>
                  <span style={{ minWidth: 40, textAlign: "center", fontSize: 16, fontWeight: 700 }}>{qty}</span>
                  <button className="fa-btn" aria-label="More" onClick={() => setQty((n) => (n < 1 ? n + 0.5 : n + 1))} style={{ width: 44, padding: 0 }}><Plus size={16} className="mx-auto" /></button>
                </div>
              </div>
            </div>

            <div className="flex flex-col" style={{ gap: 10 }}>
              <div className="flex items-center justify-between">
                <span className="fa-label">Nutrition · {selected ? "tap to edit" : "per serving"}</span>
                {selected && <button className="fa-btn" style={{ minHeight: 36, fontSize: 12 }} onClick={reset} disabled={!edited && !selected.sourceBase}>Reset</button>}
              </div>
              {FA_NUTRIENTS.map((k) => (
                <div key={k} className="flex items-center" style={{ gap: 12 }}>
                  <label htmlFor={`fa-f-${k}`} style={{ flexGrow: 1, fontSize: 14, fontWeight: 600 }}>{FIELD[k].label}</label>
                  <input
                    id={`fa-f-${k}`}
                    className="fa-input"
                    inputMode="decimal"
                    value={fields[k]}
                    onChange={(e) => {
                      setFields({ ...fields, [k]: e.target.value.replace(/[^0-9.]/g, "") });
                      setEdited(true);
                      setResetToSource(false);
                    }}
                    style={{ width: 86, textAlign: "right" }}
                  />
                  <span style={{ width: 34, fontSize: 13, color: "var(--fa-dim)" }}>{FIELD[k].unit}</span>
                </div>
              ))}
              <p style={{ margin: 0, fontSize: 12, color: "var(--fa-dim)" }}>
                {selected
                  ? resetToSource
                    ? "Your version will be removed and the original numbers used from now on."
                    : "Edited values are saved as your version of this food and reused next time."
                  : "Saved as your own food, so it shows up in search next time."}
              </p>
            </div>

            <div className="flex" style={{ gap: 10 }}>
              <button
                className="fa-btn fa-btn-primary flex-1"
                style={{ height: 52, fontSize: 15 }}
                disabled={!!busy || !total || (custom && !customName.trim())}
                onClick={selected ? add : addCustom}
              >
                {busy === "add" ? "Adding…" : `Add ${fmt(total?.kcal ?? 0)} kcal`}
              </button>
              {selected && (
                <button
                  aria-label={favourite ? "Remove from favourites" : "Save as favourite"}
                  aria-pressed={favourite}
                  onClick={toggleFavourite}
                  className="flex items-center justify-center"
                  style={{ width: 52, height: 52, borderRadius: 14, border: "1px solid var(--fa-line)", background: "#fff", color: favourite ? "var(--fa-accent)" : "var(--fa-ink)" }}
                >
                  <Star size={20} fill={favourite ? "currentColor" : "none"} />
                </button>
              )}
            </div>
          </section>
        )}
      </div>

      {scanning && <BarcodeScanner onCode={onBarcode} onClose={() => setScanning(false)} />}
    </Sheet>
  );
}
