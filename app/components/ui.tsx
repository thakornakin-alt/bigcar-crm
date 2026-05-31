"use client";

import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Calculator, CalendarDays, Car, CheckSquare, FileText, Home, Menu, Plus, Radio, Settings, UploadCloud, Users, Wrench, X } from "lucide-react";
import { useSalesProfile } from "@/lib/use-sales-profile";

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function PageContainer({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <main className={`mx-auto min-h-screen w-full px-4 pb-24 pt-5 sm:px-6 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
      {children}
    </main>
  );
}

export function PageTitle({
  title,
  subtitle,
  actions
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <>
      <GlobalNav />
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Big Car CRM</p>
          <h1 className="mt-1 text-2xl font-bold tracking-normal text-white">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-soft">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>}
      </header>
    </>
  );
}

export function TopMenuButton({
  href,
  icon,
  children,
  variant = "secondary",
  iconOnly = false,
  label
}: {
  href: string;
  icon: ReactNode;
  children?: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  iconOnly?: boolean;
  label?: string;
}) {
  const variantClass =
    variant === "primary"
      ? "border-brand bg-brand text-ink hover:border-brand"
      : variant === "danger"
        ? "border-red-400/40 bg-red-950/20 text-red-100 hover:border-red-300"
        : variant === "ghost"
          ? "border-line/70 bg-[#0b0d11] text-soft hover:border-brand/60 hover:text-white"
          : "border-line bg-panel text-white hover:border-brand/60";

  return (
    <Link
      href={href}
      aria-label={label || (typeof children === "string" ? children : undefined)}
      title={label || (typeof children === "string" ? children : undefined)}
      className={classNames(
        "flex min-h-11 items-center justify-center gap-2 rounded-lg border text-sm font-bold transition",
        iconOnly ? "h-11 w-11 px-0" : "px-3",
        variantClass
      )}
    >
      <span className={classNames("flex h-[18px] w-[18px] items-center justify-center", variant === "primary" ? "text-ink" : "text-brand")} aria-hidden="true">
        {icon}
      </span>
      {!iconOnly && children}
    </Link>
  );
}

export function ProfileIndicator() {
  const { user, loading } = useSalesProfile();
  const name = loading ? "..." : user?.nickname || user?.firstName || "RDD";
  const avatarStyle = { backgroundImage: `url(${user?.avatarUrl || "/logo-rdd.png"})` };

  return (
    <Link
      href="/profile"
      className="flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-2.5 text-sm font-black text-white transition hover:border-brand/50 hover:bg-white/[0.07]"
      aria-label="โปรไฟล์"
      title="โปรไฟล์"
    >
      <span
        className={`flex h-8 shrink-0 items-center justify-center bg-center ring-1 ring-brand/30 ${
          user?.avatarUrl ? "w-8 rounded-full bg-brand bg-cover" : "w-10 rounded-md bg-white bg-contain bg-no-repeat"
        }`}
        style={avatarStyle}
        aria-hidden="true"
      />
      <span className="max-w-[92px] truncate">{name}</span>
    </Link>
  );
}

export function SettingsIconButton() {
  return <TopMenuButton href="/settings" icon={<Settings size={18} />} iconOnly label="Settings" variant="ghost" />;
}

export function HeaderUtilities() {
  const pathname = usePathname();
  return (
    <>
      {pathname !== "/settings" && <SettingsIconButton />}
    </>
  );
}

const globalNavItems = [
  { href: "/dashboard", label: "หน้าแรก", icon: Home },
  { href: "/stock-export", label: "สต๊อก", icon: Car },
  { href: "/calculator", label: "ค่างวด", icon: Calculator },
  { href: "/realtime-booking", label: "แย่งคิวรถ", icon: Radio },
  { href: "/booking-reports", label: "รายงานจอง", icon: FileText },
  { href: "/sales-reports", label: "รายงานขาย", icon: FileText },
  { href: "/vehicle-prep", label: "รอส่งมอบ", icon: Wrench },
  { href: "/leads", label: "ลูกค้ามุ่งหวัง", icon: Users },
  { href: "/finance-approval", label: "รอผลไฟแนนซ์", icon: UploadCloud },
  { href: "/calendar", label: "ปฏิทิน", icon: CalendarDays },
  { href: "/approval-forms", label: "อนุมัติ", icon: CheckSquare },
  { href: "/documents", label: "เอกสาร", icon: FileText },
  { href: "/settings", label: "ตั้งค่า", icon: Settings }
];

export function GlobalNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const hasOddMenuCount = globalNavItems.length % 2 === 1;

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    if (href.startsWith("/#")) return false;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className="sticky top-0 z-50 mb-5 rounded-[24px] border border-white/10 bg-[#070b10]/88 shadow-[0_18px_48px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="flex min-h-[66px] items-center justify-between gap-3 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2" aria-label="BIG CAR RDD CRM หน้าแรก">
            <span className="h-10 w-14 shrink-0 rounded-xl bg-white bg-contain bg-center bg-no-repeat ring-1 ring-brand/25" style={{ backgroundImage: "url('/logo-rdd.png')" }} />
            <span className="hidden leading-tight xl:block">
              <span className="block text-sm font-black tracking-[0.16em] text-white">BIG CAR RDD</span>
              <span className="block text-[11px] font-bold uppercase tracking-[0.22em] text-brand">Workspace</span>
            </span>
          </Link>
          <ProfileIndicator />
        </div>

        <div className="hidden flex-1 flex-wrap items-center justify-center gap-1 lg:flex">
          {globalNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={classNames(
                  "flex min-h-10 items-center gap-2 rounded-xl px-2.5 text-xs font-bold transition xl:px-3 xl:text-sm",
                  active ? "bg-white text-ink shadow-[0_10px_30px_rgba(255,255,255,0.12)]" : "text-soft hover:bg-white/7 hover:text-white"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={17} className={active ? "text-ink" : "text-brand"} />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <TopMenuButton href="/notifications" icon={<Bell size={18} />} iconOnly label="แจ้งเตือน" variant="ghost" />
          <SettingsIconButton />
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-brand lg:hidden"
            aria-label={open ? "ปิดเมนู" : "เปิดเมนู"}
          >
            {open ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="grid grid-cols-2 gap-2 border-t border-white/10 p-3 lg:hidden">
          {globalNavItems.map((item, index) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={classNames(
                  "flex min-h-12 items-center gap-3 rounded-xl border px-3 text-sm font-bold",
                  hasOddMenuCount && index === 0 ? "col-span-2" : "",
                  active ? "border-white bg-white text-ink" : "border-white/10 bg-white/5 text-white"
                )}
              >
                <Icon size={18} className={active ? "text-ink" : "text-brand"} />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}

export function AppHeader({
  title,
  subtitle,
  actions
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <>
      <GlobalNav />
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Big Car CRM</p>
          <h1 className="mt-1 text-2xl font-bold tracking-normal text-white">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-soft">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>}
      </header>
    </>
  );
}

export function SectionCard({
  title,
  icon,
  children,
  className = ""
}: {
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[24px] border border-white/10 bg-[linear-gradient(145deg,rgba(17,24,32,0.92),rgba(7,10,15,0.94))] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)] ${className}`}>
      {title && (
        <h2 className="mb-3 flex items-center gap-2 text-lg font-black text-white">
          {icon && <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-brand/25 bg-brand/10 text-brand">{icon}</span>}
          {title}
        </h2>
      )}
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function NativeAppShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <main className={classNames("mx-auto min-h-screen w-full max-w-3xl px-4 pb-28 pt-4 sm:px-6", className)}>
      {children}
    </main>
  );
}

export function NativeAppHeader({
  title,
  subtitle,
  eyebrow = "",
  actions
}: {
  title: string;
  subtitle?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <>
      <GlobalNav />
      <header className="mb-5 overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.16),transparent_34%),linear-gradient(135deg,#101720,#06090e)] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.32)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow ? <p className="text-[11px] font-black uppercase tracking-[0.22em] text-brand">{eyebrow}</p> : null}
            <h1 className={classNames("text-2xl font-black tracking-normal text-white sm:text-3xl", eyebrow ? "mt-2" : "")}>{title}</h1>
            {subtitle ? <div className="mt-2 text-sm font-medium text-soft">{subtitle}</div> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      </header>
    </>
  );
}

export function NativeCard({
  children,
  className = "",
  interactive = false
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <section
      className={classNames(
        "rounded-[24px] border border-white/10 bg-[linear-gradient(145deg,rgba(17,24,32,0.92),rgba(7,10,15,0.94))] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.24)]",
        interactive && "transition hover:border-brand/50 hover:bg-[#111820] active:scale-[0.99]",
        className
      )}
    >
      {children}
    </section>
  );
}

export function NativeButton({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const variantClass =
    variant === "primary"
      ? "border-brand bg-brand text-ink"
      : variant === "danger"
        ? "border-red-400/45 bg-red-950/30 text-red-100"
        : variant === "ghost"
          ? "border-white/10 bg-white/[0.04] text-soft"
          : "border-white/10 bg-[#0b0d11] text-white";

  return (
    <button
      type="button"
      {...props}
      className={classNames(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-black transition hover:border-brand/70 disabled:cursor-not-allowed disabled:opacity-50",
        variantClass,
        className
      )}
    >
      {children}
    </button>
  );
}

export function NativeBadge({ children, tone = "brand" }: { children: ReactNode; tone?: "brand" | "muted" | "warning" }) {
  const toneClass =
    tone === "warning"
      ? "border-amber-300/35 bg-amber-300/10 text-amber-100"
      : tone === "muted"
        ? "border-line bg-[#0b0d11] text-soft"
        : "border-brand/40 bg-brand/10 text-brand";
  return <span className={classNames("inline-flex min-h-7 items-center rounded-full border px-3 text-xs font-black", toneClass)}>{children}</span>;
}

export function NativeBottomNav() {
  const pathname = usePathname();
  const items = globalNavItems.slice(0, 5);
  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 gap-1 rounded-[24px] border border-white/10 bg-[#070b10]/92 p-2 shadow-[0_18px_52px_rgba(0,0,0,0.34)] backdrop-blur-xl lg:hidden">
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={classNames(
              "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-black",
              active ? "bg-white text-ink shadow-[0_10px_26px_rgba(255,255,255,0.12)]" : "text-soft"
            )}
          >
            <Icon size={17} className={active ? "text-ink" : "text-brand"} />
            <span className="max-w-full truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function FloatingActionButton({ href, label = "เพิ่ม", icon = <Plus size={22} /> }: { href: string; label?: string; icon?: ReactNode }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-2xl border border-brand/50 bg-brand text-ink shadow-glow transition active:scale-95 lg:hidden"
    >
      {icon}
    </Link>
  );
}

export function StickyFilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky top-2 z-20 -mx-1 rounded-[22px] border border-white/10 bg-[#080c12]/92 p-2 shadow-[0_16px_44px_rgba(0,0,0,0.26)] backdrop-blur-xl sm:mx-0">
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function SearchField({
  icon,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  icon?: ReactNode;
}) {
  return (
    <label className={classNames("flex min-h-12 items-center gap-2 rounded-2xl border border-white/10 bg-[#080c12] px-3 text-white transition focus-within:border-brand/80", className)}>
      {icon && <span className="flex h-5 w-5 shrink-0 items-center justify-center text-brand">{icon}</span>}
      <input
        {...props}
        className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-[#6f7785]"
      />
    </label>
  );
}

export function FilterChip({
  active = false,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
}) {
  return (
    <button
      type="button"
      {...props}
      className={classNames(
        "min-h-10 rounded-2xl border px-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-45",
        active ? "border-white bg-white text-ink shadow-[0_10px_26px_rgba(255,255,255,0.12)]" : "border-white/10 bg-white/[0.04] text-soft hover:border-brand/60 hover:text-white",
        className
      )}
    >
      {children}
    </button>
  );
}

export function FilterSummaryPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-line bg-[#0b0d11] px-3 py-1 text-xs font-semibold text-soft">
      {children}
    </span>
  );
}

export function ActiveFilterTag({
  children,
  onRemove
}: {
  children: ReactNode;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex min-h-8 items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-3 text-xs font-bold text-brand transition hover:bg-brand hover:text-ink"
    >
      <span>{children}</span>
      <span aria-hidden="true">×</span>
    </button>
  );
}

export function BottomSheet({
  open,
  title,
  children,
  footer,
  onClose
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-3 pb-3 backdrop-blur-sm sm:items-center sm:pb-0">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="ปิด" onClick={onClose} />
      <section className="relative max-h-[88vh] w-full max-w-xl overflow-hidden rounded-lg border border-line bg-panel shadow-glow">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-[#0b0d11] text-xl font-bold text-white transition hover:border-brand"
            aria-label="ปิด"
          >
            ×
          </button>
        </header>
        <div className="max-h-[65vh] overflow-y-auto px-4 py-4">
          <div className="space-y-3">{children}</div>
        </div>
        {footer && <footer className="border-t border-line px-4 py-3">{footer}</footer>}
      </section>
    </div>
  );
}
