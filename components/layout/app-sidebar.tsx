import Image from "next/image";
import Link from "next/link";
import {
  BarChart3,
  Banknote,
  BrainCircuit,
  BriefcaseBusiness,
  Building2,
  Boxes,
  ClipboardList,
  FileText,
  FolderLock,
  Gauge,
  GraduationCap,
  HelpCircle,
  Landmark,
  LockKeyhole,
  ShieldCheck,
  Settings,
  Timer,
  Users,
} from "lucide-react";
import { LogoutButton } from "@/components/layout/logout-button";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/onboarding", label: "Onboarding", icon: GraduationCap },
  { href: "/employees", label: "Mitarbeitende", icon: Users },
  { href: "/master-data", label: "Stammdaten", icon: Boxes },
  { href: "/job-architecture", label: "Jobarchitektur", icon: Building2 },
  { href: "/job-architecture/ai-assistant", label: "Job KI-Assist", icon: BrainCircuit },
  { href: "/pay-bands", label: "Gehaltsbaender", icon: Landmark },
  { href: "/compensation", label: "Verguetung", icon: Banknote },
  { href: "/pay-gap", label: "Pay-Gap", icon: BarChart3 },
  { href: "/compliance", label: "Compliance", icon: ShieldCheck },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/remediation", label: "Massnahmen", icon: Timer },
  { href: "/recruitment", label: "Recruiting", icon: BriefcaseBusiness },
  { href: "/disclosures", label: "Auskunft", icon: ClipboardList },
  { href: "/documents", label: "Dokumente", icon: FileText },
  { href: "/admin", label: "Administration", icon: Settings },
  { href: "/help", label: "Handbuch", icon: HelpCircle },
];

export function AppSidebar({ userName, roles }: { userName: string; roles: string[] }) {
  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-ez-petrol text-white">
      <div className="px-5 pb-4 pt-5">
        <Image src="/brand/ezag-logo-white.png" alt="Eckert & Ziegler" width={170} height={34} className="h-7 w-auto" priority />
        <div className="mt-4 text-base font-semibold leading-tight">Pay Transparency</div>
        <div className="text-base font-semibold leading-tight">HR Suite</div>
        <div className="mt-1 flex items-center gap-1 text-xs text-white/60">
          <LockKeyhole size={12} />
          Security by design
        </div>
      </div>

      <div className="mx-3 mb-3 rounded-md bg-white/10 px-3 py-2">
        <div className="text-xs uppercase tracking-wide text-white/50">Mandant</div>
        <div className="font-medium">Eckert & Ziegler</div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        {nav.map((item) => (
          <Link key={item.href} href={item.href} className="focus-ring flex items-center gap-3 rounded px-3 py-2 text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white">
            <item.icon size={17} />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="rounded-md bg-white/10 p-3">
          <div className="truncate font-medium">{userName}</div>
          <div className="mt-1 flex items-center gap-1 text-xs text-white/60">
            <FolderLock size={12} />
            {roles.join(", ")}
          </div>
        </div>
        <div className="mt-2">
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}
