"use client";

import { useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { X, Plus } from "lucide-react";
import { parseRupeesToPaise } from "@/lib/money";
import { MONEY_MODES, type MoneyCategory, type MoneyTx, type MoneyTxType } from "@/lib/types";

const TYPES: { value: MoneyTxType; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "saving", label: "Saving" },
  { value: "transfer", label: "Transfer" },
];

/** Ad-hoc categories fall into a catch-all group per type, so "Spent by category" and the category dropdown still make sense without asking the user to invent a group too. */
const DEFAULT_GROUP: Record<MoneyTxType, string> = {
  expense: "Miscellaneous", income: "Income", saving: "Savings", transfer: "Transfers",
};

const todayISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/**
 * Amount → category → save, in as close to 3 taps as this app's Auth.js/no-
 * client-SDK setup allows. Everything past that (note, date, mode, tags) is
 * optional and collapsed until opened.
 */
export function MoneyQuickAdd({
  onClose,
  onSaved,
  categories,
  editing,
}: {
  onClose: () => void;
  onSaved: () => void;
  categories: MoneyCategory[];
  /** Pre-fills every field and PATCHes instead of POSTing when set — same sheet, edit mode. */
  editing?: MoneyTx;
}) {
  const [type, setType] = useState<MoneyTxType>(editing?.type ?? "expense");
  const [amount, setAmount] = useState(editing ? String(editing.amountPaise / 100) : "");
  const [categoryId, setCategoryId] = useState<string | null>(editing?.categoryId ?? null);
  const [note, setNote] = useState(editing?.note ?? "");
  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [mode, setMode] = useState<(typeof MONEY_MODES)[number] | "">(editing?.mode ?? "");
  const [tagsInput, setTagsInput] = useState(editing?.tags.join(", ") ?? "");
  const [more, setMore] = useState(Boolean(editing));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const { mutate: globalMutate } = useSWRConfig();

  const forType = useMemo(
    () => categories.filter((c) => c.type === type && !c.archived).sort((a, b) => b.useCount - a.useCount || a.order - b.order),
    [categories, type],
  );
  const quick = forType.slice(0, 8);

  const canSave = Boolean(parseRupeesToPaise(amount) && categoryId);

  const createCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setCreatingCategory(true);
    try {
      const res = await fetch("/api/money/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, group: DEFAULT_GROUP[type], type }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not add category");
      const { category } = (await res.json()) as { category: MoneyCategory };
      await globalMutate("/api/money/categories");
      setCategoryId(category.id);
      setNewCategoryName("");
      setAddingCategory(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add category");
    } finally {
      setCreatingCategory(false);
    }
  };

  const save = async (again: boolean) => {
    const amountPaise = parseRupeesToPaise(amount);
    if (!amountPaise || !categoryId) return;
    setSaving(true);
    setError("");
    try {
      const body = {
        type, amountPaise, categoryId, date, note,
        mode: mode || undefined,
        tags: tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
      };
      const res = editing
        ? await fetch(`/api/money/tx/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await fetch("/api/money/tx", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not save");
      onSaved();
      if (again && !editing) {
        setAmount("");
        setCategoryId(null);
        setNote("");
        setTagsInput("");
      } else {
        onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(24,20,30,.45)" }} onClick={onClose}>
      <div
        className="card w-full sm:w-auto"
        style={{ maxWidth: 480, maxHeight: "90vh", overflowY: "auto", borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--line)" }}>
          <p className="display" style={{ fontSize: 18 }}>{editing ? "Edit entry" : "Add entry"}</p>
          <button onClick={onClose} aria-label="Close"><X size={18} color="var(--faint)" /></button>
        </div>

        <div className="px-5 py-4">
          <div className="flex gap-2 items-stretch" style={{ marginBottom: 16 }}>
            <div className="flex flex-1" style={{ borderRadius: 10, border: "1px solid var(--line)", overflow: "hidden" }}>
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => { setType(t.value); setCategoryId(null); }}
                  className="flex-1"
                  style={{ padding: "9px 8px", fontSize: 13, fontWeight: 600, background: type === t.value ? "var(--ink)" : "var(--card)", color: type === t.value ? "#fff" : "var(--dim)" }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {/* Always visible, not tucked under "more" — entries here are
                usually logged days after the fact in a weekly batch, so the
                date is essentially a required field, not an optional extra. */}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "0 10px", fontSize: 13, width: 132 }}
            />
          </div>

          <input
            autoFocus
            type="number"
            inputMode="decimal"
            placeholder="₹0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="display w-full"
            style={{ fontSize: 40, textAlign: "center", border: "none", outline: "none", marginBottom: 18, background: "transparent" }}
          />

          <p style={{ fontSize: 12.5, color: "var(--faint)", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 }}>Category</p>
          <div className="mb-2" style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))" }}>
            {quick.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                className="truncate"
                style={{
                  padding: "9px 10px", borderRadius: 10, fontSize: 13, textAlign: "left",
                  border: `1px solid ${categoryId === c.id ? "var(--indigo)" : "var(--line)"}`,
                  background: categoryId === c.id ? "var(--indigo)" : "var(--card)",
                  color: categoryId === c.id ? "#fff" : "var(--ink)",
                }}
              >
                {c.name}
              </button>
            ))}
            <button
              onClick={() => setAddingCategory(true)}
              className="flex items-center gap-1 truncate"
              style={{ padding: "9px 10px", borderRadius: 10, fontSize: 13, border: "1px dashed var(--line)", color: "var(--dim)" }}
            >
              <Plus size={13} /> New
            </button>
          </div>

          {categoryId && !quick.some((c) => c.id === categoryId) && (
            <p className="mb-3" style={{ fontSize: 12.5, color: "var(--indigo)", fontWeight: 600 }}>
              Selected: {forType.find((c) => c.id === categoryId)?.name ?? "—"}
            </p>
          )}

          {addingCategory && (
            <div className="card flex gap-2 mb-3" style={{ padding: 10 }}>
              <input
                autoFocus
                type="text"
                placeholder={`New ${type} category, e.g. Ad-hoc repair`}
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createCategory()}
                className="flex-1"
                style={{ border: "none", outline: "none", fontSize: 13.5, background: "transparent" }}
              />
              <button className="btn btn-plain" style={{ padding: "6px 10px", fontSize: 12.5 }} onClick={() => setAddingCategory(false)}>Cancel</button>
              <button className="btn btn-dark" style={{ padding: "6px 10px", fontSize: 12.5 }} onClick={createCategory} disabled={!newCategoryName.trim() || creatingCategory}>
                {creatingCategory ? "Adding…" : "Add"}
              </button>
            </div>
          )}

          {forType.length > 8 && (
            <select
              value={categoryId && !quick.some((c) => c.id === categoryId) ? categoryId : ""}
              onChange={(e) => setCategoryId(e.target.value || null)}
              className="w-full mb-4"
              style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 13.5 }}
            >
              <option value="">More categories…</option>
              {forType.slice(8).map((c) => <option key={c.id} value={c.id}>{c.group} · {c.name}</option>)}
            </select>
          )}

          {!more ? (
            <button onClick={() => setMore(true)} style={{ fontSize: 13, color: "var(--indigo)", fontWeight: 600, marginTop: 8 }}>
              + Note, mode, tags
            </button>
          ) : (
            <div className="mt-2" style={{ display: "grid", gap: 10 }}>
              <input
                type="text" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)}
                style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14 }}
              />
              <select
                value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}
                style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14 }}
              >
                <option value="">Payment mode</option>
                {MONEY_MODES.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
              </select>
              <input
                type="text" placeholder="Tags, comma separated (optional)" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)}
                style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14 }}
              />
            </div>
          )}

          {error && <p className="mt-3" style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>}

          <div className="flex gap-2 mt-5">
            {!editing && (
              <button className="btn btn-plain flex-1" onClick={() => save(true)} disabled={!canSave || saving}>Save &amp; add another</button>
            )}
            <button className="btn btn-dark flex-1" onClick={() => save(false)} disabled={!canSave || saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
