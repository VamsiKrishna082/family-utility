"use client";

import { useMemo, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { X, Plus, CreditCard } from "lucide-react";
import { parseRupeesToPaise } from "@/lib/money";
import { MONEY_MODES, type MoneyCard, type MoneyCardsResponse, type MoneyCategory, type MoneyTx, type MoneyTxType } from "@/lib/types";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Could not load");
  return r.json();
};

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
  initialCreditCard,
  initialCardId,
}: {
  onClose: () => void;
  onSaved: () => void;
  categories: MoneyCategory[];
  /** Pre-fills every field and PATCHes instead of POSTing when set — same sheet, edit mode. */
  editing?: MoneyTx;
  /** Opens straight into the "paid by credit card" state — used by the Credit cards page's own "Log a spend" button. */
  initialCreditCard?: boolean;
  initialCardId?: string;
}) {
  const [type, setType] = useState<MoneyTxType>(editing?.type ?? "expense");
  const [amount, setAmount] = useState(editing ? String(editing.amountPaise / 100) : "");
  const [categoryId, setCategoryId] = useState<string | null>(editing?.categoryId ?? null);
  const [note, setNote] = useState(editing?.note ?? "");
  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [mode, setMode] = useState<(typeof MONEY_MODES)[number] | "">(editing?.mode && editing.mode !== "credit_card" ? editing.mode : "");
  const [tagsInput, setTagsInput] = useState(editing?.tags.join(", ") ?? "");
  const [more, setMore] = useState(Boolean(editing));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [ccSpend, setCcSpend] = useState(initialCreditCard ?? editing?.mode === "credit_card");
  const [cardId, setCardId] = useState<string | null>(initialCardId ?? editing?.cardId ?? null);
  const [addingCard, setAddingCard] = useState(false);
  const [newCardName, setNewCardName] = useState("");
  const [creatingCard, setCreatingCard] = useState(false);
  const { mutate: globalMutate } = useSWRConfig();
  const { data: cardsData, mutate: mutateCards } = useSWR<MoneyCardsResponse>(type === "expense" ? "/api/money/cards" : null, fetcher);
  const cards = (cardsData?.items ?? []).filter((c) => !c.archived);

  const forType = useMemo(
    () => categories.filter((c) => c.type === type && !c.archived).sort((a, b) => b.useCount - a.useCount || a.order - b.order),
    [categories, type],
  );
  const quick = forType.slice(0, 8);
  const selectedCategoryName = forType.find((c) => c.id === categoryId)?.name ?? categories.find((c) => c.id === categoryId)?.name;
  const isCreditCardPaymentCategory = type === "expense" && !ccSpend && selectedCategoryName?.toLowerCase() === "credit card";
  const showCardPicker = ccSpend || isCreditCardPaymentCategory;

  const canSave = Boolean(parseRupeesToPaise(amount) && categoryId && (!ccSpend || cardId));

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

  const createCard = async () => {
    const name = newCardName.trim();
    if (!name) return;
    setCreatingCard(true);
    try {
      const res = await fetch("/api/money/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not add card");
      const { card } = (await res.json()) as { card: MoneyCard };
      await mutateCards();
      setCardId(card.id);
      setNewCardName("");
      setAddingCard(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add card");
    } finally {
      setCreatingCard(false);
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
        mode: ccSpend ? "credit_card" : (mode || undefined),
        cardId: showCardPicker && cardId ? cardId : (editing?.cardId ? null : undefined),
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
                  onClick={() => { setType(t.value); setCategoryId(null); if (t.value !== "expense") { setMode(""); setCardId(null); setCcSpend(false); } }}
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

          {type === "expense" && (
            <div className="mb-4">
              <button
                onClick={() => { const next = !ccSpend; setCcSpend(next); if (!next) setCardId(null); }}
                className="flex items-center gap-2"
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 13.5, fontWeight: 600, textAlign: "left",
                  border: `1px solid ${ccSpend ? "var(--indigo)" : "var(--line)"}`,
                  background: ccSpend ? "var(--indigo)" : "var(--card)",
                  color: ccSpend ? "#fff" : "var(--ink)",
                }}
              >
                <CreditCard size={15} /> Paid by credit card
              </button>
              {ccSpend && (
                <p style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 4 }}>Counts under this category, but won&apos;t reduce Left to spend — only the bill payment later does.</p>
              )}

              {ccSpend && (
                <div className="mt-2">
                  <select
                    value={cardId ?? ""}
                    onChange={(e) => (e.target.value === "__new" ? setAddingCard(true) : setCardId(e.target.value || null))}
                    style={{ width: "100%", borderRadius: 10, border: `1px solid ${!cardId ? "var(--red)" : "var(--line)"}`, padding: "9px 12px", fontSize: 14 }}
                  >
                    <option value="">Which card? (required)</option>
                    {cards.map((c) => <option key={c.id} value={c.id}>{c.name}{c.last4 ? ` •••• ${c.last4}` : ""}</option>)}
                    <option value="__new">+ Add a new card…</option>
                  </select>
                  {addingCard && (
                    <div className="card flex gap-2 mt-2" style={{ padding: 10 }}>
                      <input
                        autoFocus type="text" placeholder="Card name, e.g. HDFC Regalia"
                        value={newCardName} onChange={(e) => setNewCardName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && createCard()}
                        className="flex-1" style={{ border: "none", outline: "none", fontSize: 13.5, background: "transparent" }}
                      />
                      <button className="btn btn-plain" style={{ padding: "6px 10px", fontSize: 12.5 }} onClick={() => setAddingCard(false)}>Cancel</button>
                      <button className="btn btn-dark" style={{ padding: "6px 10px", fontSize: 12.5 }} onClick={createCard} disabled={!newCardName.trim() || creatingCard}>
                        {creatingCard ? "Adding…" : "Add"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
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
              {!ccSpend && (
                <select
                  value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}
                  style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14 }}
                >
                  <option value="">Payment mode</option>
                  {MONEY_MODES.filter((m) => m !== "credit_card").map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
                </select>
              )}

              {isCreditCardPaymentCategory && (
                <div>
                  <select
                    value={cardId ?? ""}
                    onChange={(e) => (e.target.value === "__new" ? setAddingCard(true) : setCardId(e.target.value || null))}
                    style={{ width: "100%", borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14 }}
                  >
                    <option value="">Which card&apos;s bill? (optional)</option>
                    {cards.map((c) => <option key={c.id} value={c.id}>{c.name}{c.last4 ? ` •••• ${c.last4}` : ""}</option>)}
                    <option value="__new">+ Add a new card…</option>
                  </select>
                  {addingCard && (
                    <div className="card flex gap-2 mt-2" style={{ padding: 10 }}>
                      <input
                        autoFocus type="text" placeholder="Card name, e.g. HDFC Regalia"
                        value={newCardName} onChange={(e) => setNewCardName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && createCard()}
                        className="flex-1" style={{ border: "none", outline: "none", fontSize: 13.5, background: "transparent" }}
                      />
                      <button className="btn btn-plain" style={{ padding: "6px 10px", fontSize: 12.5 }} onClick={() => setAddingCard(false)}>Cancel</button>
                      <button className="btn btn-dark" style={{ padding: "6px 10px", fontSize: 12.5 }} onClick={createCard} disabled={!newCardName.trim() || creatingCard}>
                        {creatingCard ? "Adding…" : "Add"}
                      </button>
                    </div>
                  )}
                </div>
              )}

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
