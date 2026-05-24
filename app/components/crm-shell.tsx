import Link from "next/link";
import { ReactNode } from "react";
import { BarChart3, Car, Home, Shield, UserRound } from "lucide-react";
import { HeaderUtilities } from "@/app/components/ui";
import { CrmUserProfile, fullName, roleLabels } from "@/lib/crm-core";

const navItems = [
  { href: "/crm", label: "CRM", icon: Home },
  { href: "/stock-export", label: "สต็อก", icon: Car },
  { href: "/profile", label: "โปรไฟล์", icon: UserRound },
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
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 pb-24 pt-5 sm:px-6 lg:grid lg:grid-cols-[230px_1fr] lg:gap-5">
      <aside className="mb-4 hidden rounded-lg border border-line bg-panel p-4 shadow-glow lg:block">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Big Car CRM</p>
        <div className="mt-4 rounded-lg border border-line bg-[#0b0d11] p-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full bg-brand bg-cover bg-center text-[11px] font-black text-ink"
            style={user.avatarUrl ? { backgroundImage: `url(${user.avatarUrl})` } : undefined}
          >
            {user.avatarUrl ? null : "RDD"}
          </div>
          <p className="mt-3 text-sm font-bold text-white">{fullName(user)}</p>
          <p className="mt-1 text-xs text-soft">{roleLabels[user.role]} · {user.branch}</p>
        </div>
        <nav className="mt-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-[#0b0d11] px-3 text-sm font-bold text-white transition hover:border-brand"
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
          <div className="flex flex-wrap items-center justify-end gap-2">
            {actions}
            <HeaderUtilities />
          </div>
        </header>
        {children}
      </section>

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
