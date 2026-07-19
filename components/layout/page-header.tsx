import type { ReactNode } from "react";

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-ez-line bg-white px-6 py-5">
      <div>
        <h1 className="text-2xl font-semibold text-ez-navy">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-ez-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
