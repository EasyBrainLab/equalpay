"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Save, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Field,
  PanelHeader,
  Result,
  centsToInput,
  dangerButton,
  inputClass,
  isoDate,
  moneyToCents,
  primaryButton,
  requestJson,
} from "@/components/ui/controls";

// App-weit einheitliches Master–Detail: Liste links (Suche/Filter, klickbare
// Zeilen), Detail-/Bearbeitungsformular rechts. Vollständig DEKLARATIV /
// SERIALISIERBAR — keine Funktions-Props — damit Server-Komponenten (mit
// Prisma) die Konfiguration direkt übergeben können. Verallgemeinert aus dem
// Admin-Muster (UsersTab/UserDetailPanel).

export type BadgeTone = "neutral" | "good" | "warn" | "danger";

export type FieldKind = "text" | "number" | "textarea" | "select" | "checkbox" | "date" | "money";
export type FieldDef = {
  name: string;
  label: string;
  kind?: FieldKind; // default "text"
  options?: { id: string; label: string }[];
  optional?: boolean; // nicht erforderlich; leer -> Anlegen: weglassen, Bearbeiten: null
  colSpan?: 1 | 2;
  placeholder?: string;
  hint?: string;
};

export type ColumnDef = {
  key: string;
  header: string;
  kind?: "text" | "code" | "subtitle" | "badge" | "link";
  subtitleKey?: string; // kind "subtitle": zweite Zeile
  tone?: Record<string, BadgeTone>; // kind "badge": Wert -> Ton ("*" = Default)
  hrefTemplate?: string; // kind "link": z. B. "/api/reports/{id}/download"
  linkLabel?: string; // kind "link"
  showKey?: string; // kind "link": nur rendern, wenn row[showKey] wahr ist
};

export type FilterDef = { field: string; label: string; options: { value: string; label: string }[] };

export type RecordRow = { id: string } & Record<string, unknown>;

function interpolate(template: string, row: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(row[key] ?? ""));
}

export function RecordManager<Row extends RecordRow>({
  title,
  description,
  icon,
  endpoint,
  rows,
  columns,
  fields,
  searchKeys,
  filters,
  canEdit = true,
  canCreate,
  newLabel = "Neu",
  toolbar,
  deleteConfirm,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  endpoint: string;
  rows: Row[];
  columns: ColumnDef[];
  fields: FieldDef[];
  searchKeys?: string[];
  filters?: FilterDef[];
  canEdit?: boolean;
  canCreate?: boolean;
  newLabel?: string;
  toolbar?: ReactNode;
  deleteConfirm?: string;
}) {
  const router = useRouter();
  const allowCreate = canCreate ?? canEdit;
  const [query, setQuery] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [selection, setSelection] = useState<string | "new" | null>(rows[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery = !needle || (searchKeys ?? []).some((key) => String(row[key] ?? "").toLowerCase().includes(needle));
      const matchesFilters = (filters ?? []).every((filter) => {
        const value = filterValues[filter.field] ?? "";
        return !value || String(row[filter.field] ?? "") === value;
      });
      return matchesQuery && matchesFilters;
    });
  }, [rows, query, filterValues, searchKeys, filters]);

  const selectedRow = selection && selection !== "new" ? rows.find((row) => row.id === selection) ?? null : null;
  const mode: "new" | "edit" | "none" = selection === "new" ? "new" : selectedRow ? "edit" : "none";

  function select(next: string | "new" | null) {
    setSelection(next);
    setMessage(undefined);
    setError(undefined);
  }

  async function run(action: () => Promise<void>, success: string): Promise<boolean> {
    setBusy(true);
    setMessage(undefined);
    setError(undefined);
    try {
      await action();
      setMessage(success);
      router.refresh();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Aktion fehlgeschlagen.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function buildPayload(form: HTMLFormElement): Record<string, unknown> {
    const data = new FormData(form);
    const creating = selection === "new";
    const emptyOptional = creating ? undefined : null;
    const out: Record<string, unknown> = {};
    for (const definition of fields) {
      const kind = definition.kind ?? "text";
      if (kind === "checkbox") {
        out[definition.name] = data.get(definition.name) === "on";
        continue;
      }
      const raw = String(data.get(definition.name) ?? "").trim();
      if (kind === "money") out[definition.name] = moneyToCents(raw);
      else if (kind === "number") out[definition.name] = raw === "" ? (definition.optional ? emptyOptional : 0) : Number(raw);
      else if (kind === "date") out[definition.name] = raw === "" ? emptyOptional : isoDate(raw);
      else out[definition.name] = raw === "" ? (definition.optional ? emptyOptional : "") : raw;
    }
    return out;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = buildPayload(event.currentTarget);
    if (mode === "new") {
      const ok = await run(async () => { await requestJson(endpoint, "POST", payload); }, "Angelegt.");
      if (ok) setSelection(null);
    } else if (mode === "edit" && selectedRow) {
      await run(async () => { await requestJson(endpoint, "PATCH", { id: selectedRow.id, ...payload }); }, "Gespeichert.");
    }
  }

  async function onDelete() {
    if (!selectedRow) return;
    const question = deleteConfirm ? interpolate(deleteConfirm, selectedRow) : "Diesen Datensatz löschen?";
    if (!window.confirm(question)) return;
    const ok = await run(async () => { await requestJson(endpoint, "DELETE", { id: selectedRow.id }); }, "Gelöscht.");
    if (ok) setSelection(null);
  }

  function renderCell(column: ColumnDef, row: Row): ReactNode {
    const value = row[column.key];
    if (column.kind === "code") return <span className="font-mono text-xs">{String(value ?? "-")}</span>;
    if (column.kind === "subtitle") {
      return (
        <div>
          <div className="font-medium text-ez-navy">{String(value ?? "-")}</div>
          <div className="text-xs text-ez-muted">{String(row[column.subtitleKey ?? ""] ?? "-")}</div>
        </div>
      );
    }
    if (column.kind === "badge") {
      const tone = column.tone?.[String(value)] ?? column.tone?.["*"] ?? "neutral";
      return <Badge tone={tone}>{String(value ?? "-")}</Badge>;
    }
    if (column.kind === "link") {
      if (column.showKey && !row[column.showKey]) return "-";
      return (
        <a className="text-ez-petrol underline" href={interpolate(column.hrefTemplate ?? "", row)} onClick={(event) => event.stopPropagation()}>
          {column.linkLabel ?? "Öffnen"}
        </a>
      );
    }
    return String(value ?? "-");
  }

  function renderField(definition: FieldDef) {
    const kind = definition.kind ?? "text";
    const disabled = !canEdit;
    let value = "";
    let checked = false;
    if (mode === "edit" && selectedRow) {
      const raw = selectedRow[definition.name];
      if (kind === "checkbox") checked = Boolean(raw);
      else if (kind === "money") value = raw === null || raw === undefined ? "" : centsToInput(Number(raw));
      else value = raw === null || raw === undefined ? "" : String(raw);
    }
    const required = !definition.optional && kind !== "checkbox";
    let control: ReactNode;
    if (kind === "select") {
      control = (
        <select className={inputClass} name={definition.name} defaultValue={value} disabled={disabled} required={required}>
          {definition.optional && <option value="">-</option>}
          {(definition.options ?? []).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      );
    } else if (kind === "textarea") {
      control = <textarea className={inputClass} name={definition.name} rows={3} defaultValue={value} disabled={disabled} required={required} />;
    } else if (kind === "checkbox") {
      return (
        <div key={definition.name} className={definition.colSpan === 2 ? "sm:col-span-2" : ""}>
          <label className="flex items-center gap-2 text-sm text-ez-navy">
            <input type="checkbox" name={definition.name} defaultChecked={checked} disabled={disabled} /> {definition.label}
          </label>
          {definition.hint && <p className="mt-1 text-xs text-ez-muted">{definition.hint}</p>}
        </div>
      );
    } else {
      control = (
        <input
          className={inputClass}
          name={definition.name}
          type={kind === "number" ? "number" : kind === "date" ? "date" : "text"}
          inputMode={kind === "money" ? "decimal" : undefined}
          defaultValue={value}
          placeholder={definition.placeholder}
          disabled={disabled}
          required={required}
        />
      );
    }
    return (
      <Field key={definition.name} label={definition.label} hint={definition.hint} className={definition.colSpan === 2 ? "sm:col-span-2" : ""}>
        {control}
      </Field>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]">
      <section className="rounded-md border border-ez-line bg-white">
        <PanelHeader
          title={title}
          description={description}
          icon={icon}
          actions={
            <div className="flex items-center gap-2">
              {toolbar}
              {allowCreate && (
                <button type="button" className={primaryButton} onClick={() => select("new")}>
                  <Plus size={16} /> {newLabel}
                </button>
              )}
            </div>
          }
        />
        {(searchKeys?.length || filters?.length) ? (
          <div className="grid gap-3 border-b border-ez-line p-4 md:grid-cols-[1fr_auto]">
            {searchKeys?.length ? (
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-2.5 text-ez-muted" size={16} />
                <input className={`${inputClass} pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Suchen ..." />
              </label>
            ) : <div />}
            {filters?.length ? (
              <div className="flex flex-wrap gap-2">
                {filters.map((filter) => (
                  <select
                    key={filter.field}
                    className={inputClass}
                    aria-label={filter.label}
                    value={filterValues[filter.field] ?? ""}
                    onChange={(event) => setFilterValues((prev) => ({ ...prev, [filter.field]: event.target.value }))}
                  >
                    {filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-ez-bg text-xs uppercase text-ez-muted">
              <tr>{columns.map((column) => <th key={column.key} className="px-3 py-2">{column.header}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => select(row.id)}
                  className={`cursor-pointer border-t border-ez-line hover:bg-ez-petrol-50/60 ${selection === row.id ? "bg-ez-petrol-50" : ""}`}
                >
                  {columns.map((column) => <td key={column.key} className="px-3 py-2 align-top">{renderCell(column, row)}</td>)}
                </tr>
              ))}
              {!filtered.length && (
                <tr><td className="px-3 py-6 text-center text-ez-muted" colSpan={columns.length}>Keine Datensätze für die aktuelle Auswahl.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-md border border-ez-line bg-white">
        <PanelHeader
          title={mode === "new" ? "Neu anlegen" : mode === "edit" ? "Bearbeiten" : "Details"}
          description={mode === "none" ? undefined : canEdit ? undefined : "Nur-Lese-Ansicht — dir fehlt die Bearbeitungsberechtigung."}
          icon={<Pencil size={18} />}
        />
        {mode === "none" ? (
          <div className="p-4 text-sm text-ez-muted">Wähle links einen Eintrag aus{allowCreate ? ` oder lege über „${newLabel}“ einen neuen an` : ""}.</div>
        ) : (
          <form key={selection} className="space-y-4 p-4" onSubmit={onSubmit}>
            <div className="grid gap-3 sm:grid-cols-2">{fields.map(renderField)}</div>
            <Result message={message} error={error} />
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <button type="submit" className={primaryButton} disabled={busy}>
                  {mode === "new" ? <Plus size={16} /> : <Save size={16} />} {busy ? "Speichern ..." : mode === "new" ? "Anlegen" : "Speichern"}
                </button>
                {mode === "edit" && (
                  <button type="button" className={dangerButton} disabled={busy} onClick={onDelete}>
                    <Trash2 size={16} /> Löschen
                  </button>
                )}
              </div>
            )}
          </form>
        )}
      </section>
    </div>
  );
}
