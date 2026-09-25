"use client";

import { useState } from "react";
import { inputStyle, labelStyle, Modal } from "@/components/trips/shared";

export type Field =
  | { key: string; label: string; type: "text" | "url" | "date" | "time" | "textarea"; placeholder?: string; required?: boolean }
  | { key: string; label: string; type: "number"; placeholder?: string; required?: boolean }
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[]; required?: boolean };

type Values = Record<string, string>;

/**
 * One small form used by every planner list (itinerary items, stays,
 * bookings, links, to-dos, shared costs): the fields are described, the
 * values come back as strings, empty ones dropped — each caller maps them
 * onto its own shape.
 */
export function FieldForm({
  title, fields, initial, onSubmit, onClose, onDelete, submitLabel = "Save",
}: {
  title: string;
  fields: Field[];
  initial?: Values;
  onSubmit: (values: Values) => void | Promise<void>;
  onClose: () => void;
  onDelete?: () => void | Promise<void>;
  submitLabel?: string;
}) {
  const [values, setValues] = useState<Values>(initial ?? {});
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const missing = fields.some((f) => f.required && !values[f.key]?.trim());
  const set = (k: string, v: string) => setValues((cur) => ({ ...cur, [k]: v }));

  const submit = async () => {
    setBusy(true);
    try {
      const clean = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v !== ""));
      await onSubmit(clean);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div style={{ display: "grid", gap: 14 }}>
        {fields.map((f, i) => (
          <div key={f.key}>
            <label style={labelStyle} htmlFor={`ff-${f.key}`}>{f.label}{f.required ? "" : " (optional)"}</label>
            {f.type === "select" ? (
              <select id={`ff-${f.key}`} style={inputStyle} value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)}>
                {!f.required && <option value="">—</option>}
                {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : f.type === "textarea" ? (
              <textarea id={`ff-${f.key}`} rows={3} style={{ ...inputStyle, resize: "vertical" }} placeholder={f.placeholder} value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
            ) : (
              <input
                id={`ff-${f.key}`}
                autoFocus={i === 0}
                type={f.type === "number" ? "text" : f.type === "url" ? "url" : f.type}
                inputMode={f.type === "number" ? "decimal" : undefined}
                style={inputStyle}
                placeholder={f.placeholder}
                value={values[f.key] ?? ""}
                onChange={(e) => set(f.key, f.type === "number" ? e.target.value.replace(/[^\d.]/g, "") : e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !missing && f.type !== "date" && submit()}
              />
            )}
          </div>
        ))}
        <div className="flex items-center" style={{ gap: 8 }}>
          {onDelete && (confirmDelete ? (
            <>
              <button className="btn btn-plain" onClick={() => setConfirmDelete(false)}>Keep</button>
              <button className="btn" style={{ background: "var(--red)", color: "#fff" }} onClick={async () => { await onDelete(); onClose(); }}>Delete</button>
            </>
          ) : (
            <button className="btn btn-plain" style={{ color: "var(--red)" }} onClick={() => setConfirmDelete(true)}>Delete</button>
          ))}
          <button className="btn btn-dark flex-1" disabled={missing || busy} onClick={submit}>{busy ? "Saving…" : submitLabel}</button>
        </div>
      </div>
    </Modal>
  );
}

export const num = (v?: string) => (v && Number(v) > 0 ? Number(v) : undefined);
export const str = (v?: string) => (v ? v : undefined);
