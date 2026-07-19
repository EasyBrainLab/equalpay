"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlayCircle } from "lucide-react";

export function RunPayGapButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <button
      className="focus-ring inline-flex items-center gap-2 rounded bg-ez-petrol px-3 py-2 text-sm font-semibold text-white hover:bg-ez-petrol-700 disabled:cursor-wait disabled:opacity-70"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        await fetch("/api/pay-gap", { method: "POST" });
        setLoading(false);
        router.refresh();
      }}
    >
      <PlayCircle size={16} />
      {loading ? "Analyse laeuft..." : "Dry-Run starten"}
    </button>
  );
}
