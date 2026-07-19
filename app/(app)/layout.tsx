import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { getAuthSession } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen bg-ez-bg">
      <AppSidebar userName={session.user.name} roles={session.roles} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
