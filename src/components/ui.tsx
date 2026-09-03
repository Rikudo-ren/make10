import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../utils/cn';

export function Card({
  className,
  children,
  accent,
}: {
  className?: string;
  children: ReactNode;
  accent?: boolean;
}) {
  return <div className={cn('card p-5', accent && 'card-accent', className)}>{children}</div>;
}

type Variant = 'primary' | 'ghost' | 'danger' | 'soft' | 'success' | 'amber';

const VARIANTS: Record<Variant, string> = {
  primary:
    'text-white bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-[0_14px_34px_-10px_rgba(124,58,237,.7)] hover:brightness-110 border border-white/20',
  success:
    'text-white bg-gradient-to-br from-emerald-400 to-teal-500 shadow-[0_14px_34px_-10px_rgba(16,185,129,.6)] hover:brightness-110 border border-white/20',
  amber:
    'text-slate-950 bg-gradient-to-br from-amber-300 to-orange-400 shadow-[0_14px_34px_-10px_rgba(251,146,60,.6)] hover:brightness-105 border border-white/30',
  danger:
    'text-white bg-gradient-to-br from-rose-500 to-red-600 shadow-[0_14px_34px_-10px_rgba(244,63,94,.55)] hover:brightness-110 border border-white/20',
  soft: 'text-slate-100 bg-white/8 hover:bg-white/15 border border-white/15',
  ghost: 'text-slate-300 hover:text-white hover:bg-white/8 border border-transparent',
};

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold tracking-wide transition-all active:scale-[.96] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100',
        VARIANTS[variant],
        className,
      )}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold tracking-wide text-slate-300">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  'w-full rounded-xl border border-white/12 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-50';

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-3.5 py-2.5 text-left text-sm transition disabled:opacity-50',
        checked && 'border-indigo-400/50 bg-indigo-500/15',
      )}
    >
      <span className="text-slate-200">{label}</span>
      <span
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition',
          checked ? 'bg-indigo-500' : 'bg-slate-700',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
            checked ? 'left-[22px]' : 'left-0.5',
          )}
        />
      </span>
    </button>
  );
}

export function Chip({
  active,
  children,
  onClick,
  disabled,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-full border px-4 py-1.5 text-xs font-bold transition disabled:opacity-50',
        active
          ? 'border-amber-300/70 bg-gradient-to-b from-amber-400/30 to-orange-500/20 text-amber-100 shadow-[0_8px_20px_-8px_rgba(251,191,36,.6)]'
          : 'border-white/12 bg-white/5 text-slate-300 hover:bg-white/10',
      )}
    >
      {children}
    </button>
  );
}

export function formatMs(ms: number) {
  return `${(ms / 1000).toFixed(2)}秒`;
}

export function SectionTitle({ icon, children }: { icon?: string; children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-xs font-black tracking-[.25em] text-indigo-200">
      {icon && <span className="text-sm">{icon}</span>}
      {children}
    </h2>
  );
}
