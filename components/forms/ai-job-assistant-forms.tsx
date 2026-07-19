"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BrainCircuit, FileUp, Send } from "lucide-react";

type Option = { id: string; label: string };

const inputClass = "w-full rounded border border-ez-line bg-white px-3 py-2 text-sm outline-none focus:border-ez-petrol";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase text-ez-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Result({ message, error }: { message?: string; error?: string }) {
  if (!message && !error) return null;
  return <div className={`rounded px-3 py-2 text-sm ${error ? "bg-ez-burgundy-50 text-ez-burgundy-700" : "bg-emerald-50 text-emerald-700"}`}>{error ?? message}</div>;
}

export function AiJobDraftUploadForm({ companies }: { companies: Option[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  return (
    <section className="rounded-md border border-ez-line bg-white">
      <div className="border-b border-ez-line px-4 py-3">
        <div className="flex items-center gap-2">
          <BrainCircuit size={18} className="text-ez-petrol" />
          <h2 className="font-semibold text-ez-navy">Stellenbeschreibung analysieren</h2>
        </div>
        <p className="mt-1 text-sm text-ez-muted">Lokaler Entwurfsadapter ohne externe KI-Anbindung. Ergebnis bleibt bis zur HR-Freigabe ein Vorschlag.</p>
      </div>
      <form
        className="space-y-4 p-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          setBusy(true);
          setMessage(undefined);
          setError(undefined);
          try {
            const response = await fetch("/api/job-architecture/ai-assistant/upload", { method: "POST", credentials: "same-origin", body: data });
            const payload = await response.json().catch(() => ({}));
            if (response.status === 401) throw new Error("Nicht authentifiziert. Bitte erneut anmelden und dieselbe URL verwenden.");
            if (!response.ok) throw new Error(payload.error ?? "Analyse fehlgeschlagen");
            form.reset();
            setMessage(`Entwurf ${payload.draftId} wurde erstellt.`);
            router.refresh();
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Analyse fehlgeschlagen");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Business Unit"><input className={inputClass} name="businessUnit" placeholder="z. B. Medical" /></Field>
          <Field label="Gesellschaft"><select className={inputClass} name="companyCode"><option value="">-</option>{companies.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          <Field label="Datei"><input className={inputClass} name="file" type="file" accept=".txt,.md,.rtf,.docx,.pdf,text/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required /></Field>
        </div>
        <Result message={message} error={error} />
        <button
          type="submit"
          disabled={busy}
          className="focus-ring inline-flex items-center gap-2 rounded bg-ez-petrol px-3 py-2 text-sm font-medium text-white hover:bg-ez-navy disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FileUp size={16} />
          {busy ? "Analysiere..." : "Upload analysieren"}
        </button>
      </form>
    </section>
  );
}

export function AiJobDraftTransferForm({ draftId, disabled }: { draftId: string; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  return (
    <form
      className="space-y-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        setBusy(true);
        setMessage(undefined);
        setError(undefined);
        try {
          const response = await fetch(`/api/job-architecture/ai-assistant/drafts/${draftId}/transfer`, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reviewerNotes: String(data.get("reviewerNotes") ?? "") }),
          });
          const payload = await response.json().catch(() => ({}));
          if (response.status === 401) throw new Error("Nicht authentifiziert. Bitte erneut anmelden und dieselbe URL verwenden.");
          if (!response.ok) throw new Error(payload.error ?? "Uebernahme fehlgeschlagen");
          setMessage("Als Jobprofil in Review uebernommen.");
          router.refresh();
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Uebernahme fehlgeschlagen");
        } finally {
          setBusy(false);
        }
      }}
    >
      <textarea className={inputClass} name="reviewerNotes" rows={2} placeholder="Review-Notiz vor Uebernahme" disabled={disabled || busy} />
      <Result message={message} error={error} />
      <button
        type="submit"
        disabled={disabled || busy}
        className="focus-ring inline-flex items-center gap-2 rounded bg-ez-petrol px-3 py-2 text-sm font-medium text-white hover:bg-ez-navy disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Send size={16} />
        {busy ? "Uebernehme..." : "In Jobarchitektur uebernehmen"}
      </button>
    </form>
  );
}
