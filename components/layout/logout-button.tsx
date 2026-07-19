"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="focus-ring flex items-center gap-2 rounded px-3 py-2 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/login");
      }}
    >
      <LogOut size={15} />
      Abmelden
    </button>
  );
}
