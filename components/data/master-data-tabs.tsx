"use client";

import { useState } from "react";
import { RecordManager, type ColumnDef, type FieldDef, type FilterDef, type RecordRow } from "@/components/data/record-manager";

export type MasterTab = {
  key: string;
  label: string;
  title: string;
  description?: string;
  endpoint: string;
  rows: RecordRow[];
  columns: ColumnDef[];
  fields: FieldDef[];
  searchKeys?: string[];
  filters?: FilterDef[];
  canEdit: boolean;
  newLabel: string;
  deleteConfirm: string;
};

// Stammdaten als Tabs: eine Entität aktiv, gerendert über denselben
// RecordManager — identisches Bedienkonzept wie im Rest der App.
export function MasterDataTabs({ tabs }: { tabs: MasterTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");
  const current = tabs.find((tab) => tab.key === active) ?? tabs[0];
  if (!current) return null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={`focus-ring inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-semibold ${active === tab.key ? "bg-ez-petrol text-white" : "border border-ez-line bg-white text-ez-navy hover:bg-ez-petrol-50"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <RecordManager
        key={current.key}
        title={current.title}
        description={current.description}
        endpoint={current.endpoint}
        rows={current.rows}
        columns={current.columns}
        fields={current.fields}
        searchKeys={current.searchKeys}
        filters={current.filters}
        canEdit={current.canEdit}
        newLabel={current.newLabel}
        deleteConfirm={current.deleteConfirm}
      />
    </div>
  );
}
