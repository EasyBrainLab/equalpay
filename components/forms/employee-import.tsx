"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { secondaryButton } from "@/components/ui/controls";

// Kompakter CSV-Import als Sekundäraktion in der Listen-Toolbar der Mitarbeitenden.
export function EmployeeImportButton() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    const data = new FormData();
    data.set("file", file);
    try {
      const response = await fetch("/api/imports/employees", { method: "POST", credentials: "same-origin", body: data });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Import fehlgeschlagen");
      router.refresh();
    } catch (caught) {
      alert(caught instanceof Error ? caught.message : "Import fehlgeschlagen");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <button type="button" className={secondaryButton} disabled={busy} onClick={() => inputRef.current?.click()}>
        <Upload size={16} /> {busy ? "Import ..." : "CSV-Import"}
      </button>
    </>
  );
}
