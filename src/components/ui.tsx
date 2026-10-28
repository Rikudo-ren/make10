import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../utils/cn';

/* =========================================================
   アイコン（絵文字は使わない / 線画SVGに統一）
   ========================================================= */

const ICON_PATHS = {
  undo: ['M9.5 14.5 4 9l5.5-5.5', 'M4 9h9.5a6 6 0 0 1 0 12H8'],
  redo: ['M14.5 14.5 20 9l-5.5-5.5', 'M20 9h-9.5a6 6 0 0 0 0 12H16'],
  reset: ['M3.5 12a8.5 8.5 0 1 0 2.6-6.1', 'M3 4v5h5'],
  skip: ['M5 4.5 15 12l-10 7.5z', 'M18.5 4.5v15'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  alert: ['M12 4.2 2.8 20h18.4L12 4.2z', 'M12 10.4v4.2', 'M12 17.3h.01'],
  chat: ['M4 5.5h16v10.6H9.4L4 20.2V5.5z'],
  send: ['M4 12 20 4l-6 16-2.6-6.4L4 12z'],
  target: ['M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15z', 'M12 9.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z', 'M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22'],
  gear: [
    'M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z',
    'M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6 16.8 7.2M7.2 16.8l-1.6 1.6',
  ],
  check: ['M4 12.5 9.4 18 20 6'],
  play: ['M7.5 4.5 20 12 7.5 19.5z'],
  plus: ['M12 5v14', 'M5 12h14'],
  enter: ['M14 4h6v16h-6', 'M3.5 12h10.5', 'M10.5 8l4 4-4 4'],
  exit: ['M10 4H4v16h6', 'M20.5 12H10', 'M14 8l4 4-4 4'],
  copy: ['M9 9h11v11H9z', 'M15 5.5V4H4v11h1.5'],
  bolt: ['M13.4 2.5 4.5 14.2h5.6l-1 7.3 9-11.8h-5.7l1-7.2z'],
  clock: ['M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z', 'M12 7.5V12l3 2'],
  users: [
    'M2.5 20v-2.4c0-2 2.6-3.3 5-3.3s5 1.3 5 3.3V20',
    'M7.5 11.4a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M16 11.2a3.2 3.2 0 0 0 0-6.4',
    'M21.5 20v-2.2c0-1.8-1.9-3-4-3.3',
  ],
  award: ['M12 14.5a5.6 5.6 0 1 0 0-11.2 5.6 5.6 0 0 0 0 11.2z', 'M8.6 13.8 7 21.5l5-2.4 5 2.4-1.6-7.7'],
  spark: ['M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4', 'M6.2 6.2l2.6 2.6M15.2 15.2l2.6 2.6M17.8 6.2l-2.6 2.6M8.8 15.2l-2.6 2.6'],
  diamond: ['M12 3.5 20.5 12 12 20.5 3.5 12z'],
} as const;

export type IconName = keyof typeof ICON_PATHS;

export function Icon({
  name,
  className,
  strokeWidth = 1.4,
}: {
  name: IconName;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={cn('h-4 w-4 shrink-0', className)}
    >
      {ICON_PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/* =========================================================
   レイアウト部品
   ========================================================= */

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

export function Rule({ className }: { className?: string }) {
  return (
    <div className={cn('rule', className)} aria-hidden="true">
      <span className="rule-dot" />
    </div>
  );
}

export function SectionTitle({ kicker, children }: { kicker?: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="display text-[15px] tracking-[0.06em] text-bone">{children}</h2>
      {kicker && <span className="eyebrow shrink-0">{kicker}</span>}
    </div>
  );
}

/* =========================================================
   ボタン
   ========================================================= */

type Variant = 'primary' | 'ghost' | 'danger' | 'soft' | 'success' | 'amber';

const VARIANTS: Record<Variant, string> = {
  primary:
    'border border-blood bg-blood text-[#fff2f2] hover:border-[#e03551] hover:bg-[#d1304c] shadow-[0_10px_28px_-18px_rgba(194,42,69,0.9)]',
  amber:
    'border border-brass bg-brass text-ink hover:border-[#e0b62f] hover:bg-[#e0b62f] shadow-[0_10px_28px_-18px_rgba(201,162,39,0.9)]',
  success: 'border border-cyber/60 bg-cyber/12 text-cyber hover:border-cyber hover:bg-cyber/20',
  danger: 'border border-blood/55 bg-blood/12 text-[#ff8a9b] hover:border-blood hover:bg-blood/22',
  soft: 'border border-[var(--hair)] bg-[rgba(233,227,214,0.035)] text-bone hover:border-[rgba(233,227,214,0.34)] hover:bg-[rgba(233,227,214,0.07)]',
  ghost:
    'border border-transparent bg-transparent text-bone-dim hover:border-[var(--hair)] hover:text-bone',
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
        'inline-flex items-center justify-center gap-2 rounded-[3px] px-4 py-2.5 font-mono text-[12px] font-semibold tracking-[0.1em] transition-all duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-35 disabled:active:translate-y-0',
        VARIANTS[variant],
        className,
      )}
    />
  );
}

/* =========================================================
   フォーム
   ========================================================= */

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] tracking-[0.12em] text-bone-faint">{label}</span>
      {children}
    </label>
  );
}

export const inputCls = 'input-base';

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
      aria-pressed={checked}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-[3px] border px-3 py-2.5 text-left text-[13px] transition disabled:opacity-40',
        checked
          ? 'border-brass/55 bg-brass/[0.07] text-bone'
          : 'border-[var(--hair)] bg-[rgba(0,0,0,0.35)] text-bone-dim hover:border-[rgba(233,227,214,0.28)]',
      )}
    >
      <span className="leading-snug">{label}</span>
      <span
        className={cn(
          'relative h-4 w-8 shrink-0 border transition-colors',
          checked ? 'border-brass bg-brass/25' : 'border-[var(--hair)] bg-black/50',
        )}
      >
        <span
          className={cn(
            'absolute top-0 h-3 w-3 transition-all duration-150',
            checked ? 'left-4 bg-brass' : 'left-0.5 bg-bone-faint',
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
      aria-pressed={active}
      className={cn(
        'rounded-[2px] border px-3 py-1.5 font-mono text-[11px] font-semibold tracking-[0.12em] transition disabled:opacity-40',
        active
          ? 'border-brass bg-brass/15 text-[#f0d98a]'
          : 'border-[var(--hair)] bg-transparent text-bone-dim hover:border-[rgba(233,227,214,0.32)] hover:text-bone',
      )}
    >
      {children}
    </button>
  );
}

export function formatMs(ms: number) {
  return `${(ms / 1000).toFixed(2)}s`;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="読み込み中"
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-none border border-bone-faint border-t-cyber',
        className,
      )}
    />
  );
}

/* =========================================================
   確認ダイアログ
   ========================================================= */

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'OK',
  cancelLabel = 'キャンセル',
  tone = 'danger',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  // 親の transform / filter に影響されないよう body 直下に出す
  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[70] flex items-end justify-center bg-black/80 p-4 sm:items-center"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card card-accent animate-rise w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="eyebrow mb-3 tracking-[0.4em] text-blood">Confirm</div>
        <div className="display text-lg text-bone">{title}</div>
        {description && (
          <div className="mt-2.5 text-[13px] leading-relaxed text-bone-dim">{description}</div>
        )}
        <div className="mt-6 flex gap-2">
          <Button variant="soft" className="flex-1" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            className="flex-1"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
