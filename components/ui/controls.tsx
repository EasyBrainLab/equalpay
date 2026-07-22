import type { ReactNode } from "react";

// Geteilte UI-Bausteine für das app-weite Master–Detail-Bedienkonzept.
// Einzige Quelle für Eingabe-/Button-Stile, Formularfeld-Label, Feedback,
// Panel-Kopf und den JSON-Client. Ersetzt die zuvor mehrfach duplizierten
// Definitionen (admin-workspace, hr-admin-forms, master-data-forms).

export const inputClass =
  "w-full rounded border border-ez-line bg-white px-3 py-2 text-sm outline-none focus:border-ez-petrol disabled:bg-ez-bg disabled:text-ez-muted";
export const primaryButton =
  "focus-ring inline-flex items-center gap-2 rounded bg-ez-petrol px-3 py-2 text-sm font-semibold text-white hover:bg-ez-navy disabled:cursor-not-allowed disabled:opacity-60";
export const secondaryButton =
  "focus-ring inline-flex items-center gap-2 rounded border border-ez-line bg-white px-3 py-2 text-sm font-medium text-ez-navy hover:border-ez-petrol disabled:cursor-not-allowed disabled:opacity-60";
export const dangerButton =
  "focus-ring inline-flex items-center gap-2 rounded border border-ez-burgundy-100 bg-white px-3 py-2 text-sm font-medium text-ez-burgundy-700 hover:bg-ez-burgundy-50 disabled:cursor-not-allowed disabled:opacity-60";

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="text-xs font-semibold uppercase text-ez-muted">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs leading-4 text-ez-muted">{hint}</span>}
    </label>
  );
}

export function Result({ message, error }: { message?: string; error?: string }) {
  if (!message && !error) return null;
  return (
    <div className={`rounded px-3 py-2 text-sm ${error ? "bg-ez-burgundy-50 text-ez-burgundy-700" : "bg-emerald-50 text-emerald-700"}`}>
      {error ?? message}
    </div>
  );
}

export function PanelHeader({ title, description, icon, actions }: { title: string; description?: string; icon?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-ez-line px-4 py-3">
      <div className="flex items-start gap-3">
        {icon && <div className="rounded bg-ez-petrol-50 p-2 text-ez-petrol">{icon}</div>}
        <div>
          <h2 className="font-semibold text-ez-navy">{title}</h2>
          {description && <p className="mt-1 text-sm leading-5 text-ez-muted">{description}</p>}
        </div>
      </div>
      {actions}
    </div>
  );
}

export async function requestJson(path: string, method: "POST" | "PATCH" | "DELETE", payload: unknown) {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) throw new Error("Nicht authentifiziert. Bitte erneut anmelden.");
  if (!response.ok) throw new Error(data.error ?? "Aktion fehlgeschlagen.");
  return data;
}

// Geld: Cent-Betrag <-> Eingabefeld (deutsches Dezimalkomma).
export function moneyToCents(value: FormDataEntryValue | null): number {
  const normalized = String(value ?? "0").replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  return Math.round(Number(normalized) * 100);
}
export function centsToInput(cents: number): string {
  return (cents / 100).toString().replace(".", ",");
}

// Datumseingabe (YYYY-MM-DD) -> ISO-Zeitstempel für die API.
export function isoDate(value: FormDataEntryValue | null): string {
  const text = String(value ?? "");
  return new Date(`${text}T00:00:00.000Z`).toISOString();
}
