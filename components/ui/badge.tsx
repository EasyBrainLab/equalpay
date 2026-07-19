import { cn } from "@/lib/ui/cn";

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "danger" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold",
        tone === "neutral" && "bg-ez-petrol-50 text-ez-petrol-700",
        tone === "good" && "bg-emerald-50 text-emerald-700",
        tone === "warn" && "bg-amber-50 text-amber-700",
        tone === "danger" && "bg-ez-burgundy-50 text-ez-burgundy-700",
      )}
    >
      {children}
    </span>
  );
}
