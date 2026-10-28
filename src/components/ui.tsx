import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../utils/cn';
import { IconClose } from './icons';

export function Card({
  className,
  children,
  accent,
}: {
  className?: string;
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={cn('card p-5', accent && 'card-accent', className)}>
      {accent && <div className="scan-line" />}
      {children}
    </div>
  );
}

type Variant = 'primary' | 'ghost' | 'danger' | 'soft' | 'success' | 'amber' | 'magenta';

const VARIANTS: Record<Variant, string> = {
  primary: 'btn-primary',
  success: 'btn-primary',
  amber: 'btn-primary',
  magenta: 'btn-magenta',
  danger: 'btn-danger',
  soft: 'btn',
  ghost: 'btn btn-ghost',
};

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...props} className={cn('btn', VARIANTS[variant], className)} />;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label jp tracking-[.18em] text-cyan-200/70">{label}</span>
      {children}
    </label>
  );
}

export const inputCls = 'input';

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
        'jp flex w-full items-center justify-between gap-3 border px-3.5 py-2.5 text-left text-[12px] transition disabled:opacity-40',
        checked
          ? 'border-cyan-300/60 bg-cyan-400/10 text-cyan-50'
          : 'border-white/12 bg-black/30 text-slate-300 hover:border-white/25',
      )}
      style={{
        clipPath: 'polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)',
      }}
    >
      <span className="font-bold">{label}</span>
      <span
        className={cn(
          'relative h-5 w-9 shrink-0 border transition',
          checked ? 'border-cyan-300/70 bg-cyan-400/30' : 'border-white/20 bg-white/5',
        )}
      >
        <span
          className={cn(
            'absolute top-[2px] h-[14px] w-[14px] transition-all',
            checked ? 'left-[19px] bg-cyan-200 shadow-[0_0_10px_rgba(34,224,255,.9)]' : 'left-[2px] bg-slate-500',
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
        'jp border px-3.5 py-1.5 text-[11px] font-bold tracking-wider transition disabled:opacity-40',
        active
          ? 'border-cyan-300/80 bg-cyan-400/20 text-cyan-50 shadow-[0_0_20px_-8px_rgba(34,224,255,.9)]'
          : 'border-white/12 bg-white/5 text-slate-300 hover:border-white/30 hover:text-white',
      )}
      style={{
        clipPath: 'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)',
      }}
    >
      {children}
    </button>
  );
}

export function formatMs(ms: number) {
  return `${(ms / 1000).toFixed(2)}秒`;
}

export function SectionTitle({
  icon,
  children,
  className,
}: {
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2 className={cn('label flex items-center gap-2 text-cyan-100/85', className)}>
      {icon && <span className="text-cyan-300">{icon}</span>}
      {children}
    </h2>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="読み込み中"
      className={cn(
        'inline-block h-5 w-5 animate-spin rounded-full border-2 border-cyan-300/25 border-t-cyan-300',
        className,
      )}
    />
  );
}

/** 1位 / 2位 / 3位 がひと目で分かる六角バッジ（数字＋「位」） */
export function RankBadge({ rank, size = 'md' }: { rank: number; size?: 'sm' | 'md' | 'lg' }) {
  const tone = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-plain';
  const box = size === 'lg' ? 'h-16 w-16' : size === 'sm' ? 'h-9 w-9' : 'h-12 w-12';
  const num = size === 'lg' ? 'text-[30px]' : size === 'sm' ? 'text-[15px]' : 'text-[21px]';
  return (
    <span
      className={cn(
        'rank-badge shrink-0',
        size === 'sm' ? 'flex-row gap-[1px]' : 'flex-col gap-[1px]',
        tone,
        box,
      )}
      aria-label={`${rank}位`}
    >
      <span className={cn('num leading-none font-black', num)}>{rank}</span>
      <span
        className={cn(
          'leading-none opacity-85',
          size === 'sm' ? 'text-[10px] tracking-normal' : 'text-[8px] tracking-[.25em]',
        )}
      >
        位
      </span>
    </span>
  );
}

/**
 * 確認ダイアログ。取り返しのつかない操作（GMがルームを解散する等）を防ぐために使う。
 * ※ パスは取り消せるので確認ダイアログを出さない。
 */
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
  // .card の backdrop-filter は fixed の基準になるため、必ず body 直下に出す
  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card hud-corner animate-float-up w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between gap-3">
          <div className="jp text-lg font-black text-white">{title}</div>
          <button
            onClick={onCancel}
            className="shrink-0 text-slate-500 transition hover:text-cyan-200"
            aria-label="閉じる"
          >
            <IconClose size={16} />
          </button>
        </div>
        {description && (
          <div className="jp mt-2 text-[13px] leading-relaxed text-slate-300">{description}</div>
        )}
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" className="flex-1 py-3" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            className="flex-1 py-3"
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
