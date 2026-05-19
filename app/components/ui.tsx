import { ReactNode } from "react";
import Link from "next/link";

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
    <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Big Car CRM</p>
        <h1 className="mt-1 text-2xl font-bold tracking-normal text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function TopMenuButton({
  href,
  icon,
  children
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm font-semibold text-white transition hover:border-brand/60"
    >
      <span className="flex h-[18px] w-[18px] items-center justify-center text-brand" aria-hidden="true">
        {icon}
      </span>
      {children}
    </Link>
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
