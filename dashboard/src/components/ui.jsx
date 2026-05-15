import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { ChevronLeft, HelpCircle } from 'lucide-react';

export function HelpTip({ text, className }) {
  return (
    <span className={clsx('group relative inline-flex', className)}>
      <button
        type="button"
        tabIndex={0}
        aria-label={text}
        className="text-slate-500 transition hover:text-sky-300 focus:text-sky-300"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full right-1/2 z-50 mb-2 w-56 translate-x-1/2 rounded-xl border border-white/10 bg-[#0b1020] p-3 text-xs leading-5 text-slate-300 opacity-0 shadow-2xl shadow-black/60 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

export function Breadcrumbs({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <nav aria-label="breadcrumb" className="mb-2 flex items-center gap-1.5 text-xs text-slate-500">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            {item.to && !isLast ? (
              <Link to={item.to} className="transition hover:text-sky-300">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'font-bold text-slate-300' : ''}>{item.label}</span>
            )}
            {!isLast ? <ChevronLeft className="h-3 w-3" /> : null}
          </span>
        );
      })}
    </nav>
  );
}

export function PageHeader({ title, description, actions, breadcrumbs }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}
        <h1 className="text-2xl font-black tracking-tight text-white">{title}</h1>
        {description && <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ title, value, hint, icon: Icon, tone = 'blue' }) {
  const tones = {
    blue: 'border-sky-500/20 bg-sky-500/10 text-sky-400',
    green: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
    amber: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
    red: 'border-rose-500/20 bg-rose-500/10 text-rose-400',
    slate: 'border-white/10 bg-white/5 text-slate-300',
  };

  return (
    <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-5 shadow-xl shadow-black/20 backdrop-blur-sm transition-all hover:border-white/10 hover:bg-white/[0.04]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-400">{title}</p>
          <p className="mt-2 text-3xl font-black text-white">{value}</p>
          {hint && <p className="mt-2 text-xs text-slate-400">{hint}</p>}
        </div>
        {Icon && (
          <div className={clsx('rounded-2xl border p-3.5', tones[tone] || tones.blue)}>
            <Icon className="h-6 w-6" />
          </div>
        )}
      </div>
    </div>
  );
}

export function DataCard({ children, className }) {
  return <div className={clsx('rounded-3xl border border-white/5 bg-white/[0.02] p-6 shadow-xl shadow-black/20 backdrop-blur-sm', className)}>{children}</div>;
}

export function StatusBadge({ children, tone = 'slate' }) {
  const tones = {
    slate: 'border border-white/10 bg-white/5 text-slate-300',
    green: 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    amber: 'border border-amber-500/20 bg-amber-500/10 text-amber-300',
    red: 'border border-rose-500/20 bg-rose-500/10 text-rose-300',
    blue: 'border border-sky-500/20 bg-sky-500/10 text-sky-300',
  };

  return <span className={clsx('inline-flex rounded-full px-3 py-1 text-xs font-bold', tones[tone] || tones.slate)}>{children}</span>;
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-300">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border border-white/10 bg-[#0d1225] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20';

export function PrimaryButton({ children, className, ...props }) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className, ...props }) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function DangerButton({ children, className, ...props }) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-red-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-rose-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function LoadingSpinner({ size = 'md', className }) {
  const sizes = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-[3px]',
    lg: 'h-10 w-10 border-4',
  };
  return (
    <span
      className={clsx(
        'inline-block animate-spin rounded-full border-sky-500/25 border-t-sky-400',
        sizes[size] || sizes.md,
        className
      )}
      aria-label="جاري التحميل"
      role="status"
    />
  );
}

export function PageLoader({ label = 'جاري التحميل...', className }) {
  return (
    <div className={clsx('flex flex-col items-center justify-center gap-4 py-16', className)}>
      <LoadingSpinner size="lg" />
      {label ? <p className="text-sm font-medium text-slate-400">{label}</p> : null}
    </div>
  );
}
