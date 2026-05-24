import Link from "next/link";
import { ReactNode } from "react";
import { BarChart3, Car, FileText, Home, Radio, Shield, UploadCloud, Users, Wrench } from "lucide-react";
import { GlobalNav } from "@/app/components/ui";
import { CrmUserProfile, fullName, roleLabels } from "@/lib/crm-core";

const navItems = [
  { href: "/crm", label: "CRM", icon: Home },
  { href: "/stock-export", label: "สต็อก", icon: Car },
  { href: "/realtime-booking", label: "แย่งคิวรถ", icon: Radio },
  { href: "/booking-reports", label: "รายงานจอง", icon: FileText },
  { href: "/sales-reports", label: "รายงานขาย", icon: FileText },
  { href: "/vehicle-prep", label: "การเตรียมรถ", icon: Wrench },
  { href: "/leads", label: "ลูกค้ามุ่งหวัง", icon: Users },
  { href: "/finance-approval", label: "ไฟแนนซ์", icon: UploadCloud },
  { href: "/admin/crm", label: "Admin", icon: Shield }
];

export function CrmShell({
  user,
  title,
  subtitle,
  children,
  actions
}: {
  user: CrmUserProfile;
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 pb-24 pt-5 sm:px-6">
      <GlobalNav />
      <div className="lg:grid lg:grid-cols-[230px_1fr] lg:gap-5">
      <aside className="mb-4 hidden rounded-lg border border-line bg-panel p-4 shadow-glow lg:block">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Big Car CRM</p>
        <p className="mt-1 text-xs text-soft">{fullName(user)} · {roleLabels[user.role]}</p>
        <nav className="mt-4 grid grid-cols-2 gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border border-line bg-[#0b0d11] px-2 text-center text-xs font-bold text-white transition hover:border-brand"
              >
                <Icon size={18} className="text-brand" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <section className="min-w-0">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">BIG CAR CRM V2</p>
            <h1 className="mt-1 text-2xl font-bold tracking-normal text-white">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-soft">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>}
        </header>
        {children}
      </section>
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-4 gap-2 rounded-lg border border-line bg-[#11141a]/95 p-2 shadow-glow backdrop-blur lg:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-bold text-soft">
              <Icon size={18} className="text-brand" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </main>
  );
}

export function MetricCard({ label, value, hint, icon }: { label: string; value: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4 shadow-glow">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-soft">{label}</p>
        {icon || <BarChart3 size={18} className="text-brand" />}
      </div>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-soft">{hint}</p>}
    </div>
  );
}
