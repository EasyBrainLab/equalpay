"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";

export type MdField = {
  name: string;
  label: string;
  kind?: "text" | "number" | "select";
  options?: { id: string; label: string }[];
  optional?: boolean;
};

export type MdRow = { id: string; label: string; values: Record<string, string> };

const inputClass = "w-full rounded border border-ez-line bg-white px-3 py-2 text-sm outline-none focus:border-ez-petrol";

async function send(endpoint: string, method: "POST" | "PATCH" | "DELETE", payload: unknown) {
  const response = await fetch(endpoint, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) throw new Error("Nicht authentifiziert. Bitte erneut anmelden.");
  if (!response.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen");
  return data;
}

function collect(form: HTMLFormElement, fields: MdField[]): Record<string, unknown> {
  const data = new FormData(form);
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = String(data.get(field.name) ?? "").trim();
    if (field.kind === "number") out[field.name] = raw === "" ? 0 : Number(raw);
    else out[field.name] = raw === "" ? (field.optional ? null : "") : raw;
  }
  return out;
}

function FieldInput({ field, defaultValue }: { field: MdField; defaultValue?: string }) {
  if (field.kind === "select") {
    return (
      <select className={inputClass} name={field.name} defaultValue={defaultValue ?? ""}>
        {field.optional && <option value="">-</option>}
        {(field.options ?? []).map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
    );
  }
  return (
    <input
      className={inputClass}
      name={field.name}
      type={field.kind === "number" ? "number" : "text"}
      defaultValue={defaultValue ?? ""}
      required={!field.optional}
    />
  );
}

function Label({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase text-ez-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Feedback({ message, error }: { message?: string; error?: string }) {
  if (!message && !error) return null;
  return <div className={`rounded px-3 py-2 text-sm ${error ? "bg-ez-burgundy-50 text-ez-burgundy-700" : "bg-emerald-50 text-emerald-700"}`}>{error ?? message}</div>;
}

export function MasterDataSection({
  title,
  description,
  endpoint,
  fields,
  rows,
}: {
  title: string;
  description: string;
  endpoint: string;
  fields: MdField[];
  rows: MdRow[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(rows[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0];

  async function run(action: () => Promise<void>, success: string, form?: HTMLFormElement) {
    setBusy(true);
    setMessage(undefined);
    setError(undefined);
    try {
      await action();
      if (form) form.reset();
      setMessage(success);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Aktion fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-md border border-ez-line bg-white">
      <div className="border-b border-ez-line px-4 py-3">
        <h2 className="font-semibold text-ez-navy">{title}</h2>
        <p className="mt-1 text-sm text-ez-muted">{description}</p>
      </div>
      <div className="grid gap-6 p-4 lg:grid-cols-2">
        {/* Anlegen */}
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            void run(async () => { await send(endpoint, "POST", collect(form, fields)); }, "Angelegt.", form);
          }}
        >
          <div className="text-xs font-semibold uppercase text-ez-muted">Neu anlegen</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((field) => (
              <Label key={field.name} label={field.label}><FieldInput field={field} /></Label>
            ))}
          </div>
          <button type="submit" disabled={busy} className="focus-ring inline-flex items-center gap-2 rounded bg-ez-petrol px-3 py-2 text-sm font-medium text-white hover:bg-ez-navy disabled:opacity-60">
            <Plus size={16} /> {busy ? "Speichern..." : "Anlegen"}
          </button>
        </form>

        {/* Bearbeiten / Löschen */}
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase text-ez-muted">Bearbeiten / Löschen</div>
          {!selected ? (
            <div className="text-sm text-ez-muted">Noch keine Eintraege vorhanden.</div>
          ) : (
            <>
              <Label label="Eintrag auswaehlen">
                <select className={inputClass} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                  {rows.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
                </select>
              </Label>
              <form
                key={selected.id}
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  void run(async () => { await send(endpoint, "PATCH", { id: selected.id, ...collect(form, fields) }); }, "Aktualisiert.");
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {fields.map((field) => (
                    <Label key={field.name} label={field.label}><FieldInput field={field} defaultValue={selected.values[field.name]} /></Label>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={busy} className="focus-ring inline-flex items-center gap-2 rounded bg-ez-petrol px-3 py-2 text-sm font-medium text-white hover:bg-ez-navy disabled:opacity-60">
                    <Pencil size={16} /> Aktualisieren
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="focus-ring inline-flex items-center gap-2 rounded border border-ez-burgundy-100 bg-white px-3 py-2 text-sm font-medium text-ez-burgundy-700 hover:bg-ez-burgundy-50 disabled:opacity-60"
                    onClick={() => {
                      if (!window.confirm(`"${selected.label}" loeschen?`)) return;
                      void run(async () => { await send(endpoint, "DELETE", { id: selected.id }); setSelectedId(""); }, "Geloescht.");
                    }}
                  >
                    <Trash2 size={16} /> Loeschen
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
      <div className="px-4 pb-4"><Feedback message={message} error={error} /></div>
    </section>
  );
}
