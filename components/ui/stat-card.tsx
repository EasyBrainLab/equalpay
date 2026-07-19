import type { LucideIcon } from "lucide-react";

export function StatCard({ label, value, detail, icon: Icon }: { label: string; value: string | number; detail?: string; icon: LucideIcon }) {
  return (
    <div className="rounded-md border border-ez-line bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-ez-muted">{label}</div>
          <div className="mt-2 text-2xl font-semibold text-ez-navy">{value}</div>
          {detail && <div className="mt-1 text-sm text-ez-muted">{detail}</div>}
        </div>
        <div className="rounded-md bg-ez-petrol-50 p-2 text-ez-petrol">
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}
