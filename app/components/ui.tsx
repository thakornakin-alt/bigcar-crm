"use client";

import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, UserRound } from "lucide-react";
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
    <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Big Car CRM</p>
        <h1 className="mt-1 text-2xl font-bold tracking-normal text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-soft">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {actions}
        <HeaderUtilities />
      </div>
    </header>
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
  const name = loading ? "Loading" : user?.nickname || user?.firstName || "RDD";
  const avatarStyle = { backgroundImage: `url(${user?.avatarUrl || "/logo-rdd.png"})` };

  return (
    <Link
      href="/profile"
      className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-panel px-2.5 text-sm font-black text-white transition hover:border-brand/60"
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
      <ProfileIndicator />
      {pathname !== "/settings" && <SettingsIconButton />}
    </>
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
    <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Big Car CRM</p>
        <h1 className="mt-1 text-2xl font-bold tracking-normal text-white">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-soft">{subtitle}</div>}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {actions}
        <HeaderUtilities />
      </div>
    </header>
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
    <section className={`rounded-lg border border-line bg-panel p-4 shadow-glow ${className}`}>
      {title && (
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
          {icon && <span className="flex h-[18px] w-[18px] items-center justify-center text-brand">{icon}</span>}
          {title}
        </h2>
      )}
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function StickyFilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky top-2 z-20 -mx-1 rounded-lg border border-line/80 bg-[#11141a]/95 p-2 shadow-glow backdrop-blur sm:mx-0">
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
    <label className={classNames("flex min-h-12 items-center gap-2 rounded-lg border border-line bg-[#0b0d11] px-3 text-white transition focus-within:border-brand", className)}>
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
        "min-h-10 rounded-lg border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45",
        active ? "border-brand bg-brand text-ink" : "border-line bg-[#0b0d11] text-soft hover:border-brand/60 hover:text-white",
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
