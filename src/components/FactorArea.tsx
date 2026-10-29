import { useEffect, useRef, useState } from 'react';
import { Button } from './ui';
import { IconCheck, IconLock, IconReset, IconSkip, IconUndo } from './icons';
import { playSe } from '../lib/audio';
import { cn } from '../utils/cn';
import {
  checkFactorStep,
  FACTOR_GUESS_ERROR_TEXT,
  factorFormula,
  factorKey,
  productOf,
} from '../lib/factor';

interface Props {
  /** 分解する合成数 */
  value: number;
  disabled?: boolean;
  disabledReason?: string;
  penaltyMode: 'none' | 'lock';
  onSolved: (formula: string, key: string) => void;
  onPass?: () => void;
  onCancelPass?: () => void;
  passed?: boolean;
  isCountdown?: boolean;
  roundKey?: string | number;
}

/** 全角数字・空白を半角に寄せる（スマホ入力やIME経由でもそのまま判定できるように） */
function normalizeInput(raw: string): string {
  return raw
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[^\d]/g, '');
}

/**
 * 素因数分解の入力盤面。
 * 素数を1つ入力して Enter するたびに「積」へ積み上がっていき、積が目標と一致したら完了。
 * 問題の数が割れて残りが減っていく表示はしない（残りが見えると簡単すぎるため）。
 * 画面に出るのは「2×2×3=12」のような現在の積だけ。
 */
export function FactorArea({
  value,
  disabled,
  disabledReason,
  penaltyMode,
  onSolved,
  onPass,
  onCancelPass,
  passed,
  isCountdown,
  roundKey,
}: Props) {
  const [factors, setFactors] = useState<number[]>([]);
  const product = productOf(factors);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const solvedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resumeRequestedRef = useRef(false);

  // 問題が変わったら盤面を初期化
  useEffect(() => {
    setFactors([]);
    setInput('');
    setError(null);
    setLockUntil(0);
    solvedRef.current = false;
    resumeRequestedRef.current = false;
  }, [value, roundKey]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!passed) resumeRequestedRef.current = false;
  }, [passed]);

  const over = product > value;
  const lockRemain = Math.max(0, lockUntil - now);
  const locked = !!disabled || !!isCountdown || lockRemain > 0;
  const canRequestPass = !!onPass && !passed && !disabled && !isCountdown;

  /** パス中に操作したら「やっぱり解く」とみなしてパスを取り消す */
  const resumeIfPassed = () => {
    if (!passed || !onCancelPass || resumeRequestedRef.current) return;
    resumeRequestedRef.current = true;
    onCancelPass();
  };

  const fail = (message: string) => {
    setError(message);
    setShake((s) => s + 1);
    playSe('wrong');
    if (penaltyMode === 'lock') setLockUntil(Date.now() + 5000);
  };

  const submit = () => {
    if (locked || solvedRef.current) return;
    const text = normalizeInput(input);
    const parsed = text === '' ? NaN : Number(text);
    const result = checkFactorStep({ target: value, currentProduct: product, value: parsed });
    if (!result.ok) {
      fail(
        result.reason === 'not-prime'
          ? `${text || 'その数'}は素数ではありません（まだ割れる数です）`
          : FACTOR_GUESS_ERROR_TEXT[result.reason],
      );
      return;
    }
    resumeIfPassed();
    const nextFactors = [...factors, result.value];
    setFactors(nextFactors);
    setInput('');
    setError(null);
    inputRef.current?.focus();
    if (result.nextProduct === value) {
      solvedRef.current = true;
      playSe('correct');
      onSolved(factorFormula(nextFactors), factorKey(nextFactors));
    } else {
      playSe('calc');
    }
  };

  const undo = () => {
    if (locked || factors.length === 0) return;
    resumeIfPassed();
    setFactors(factors.slice(0, -1));
    setError(null);
    playSe('ui');
    inputRef.current?.focus();
  };

  const reset = () => {
    if (locked) return;
    resumeIfPassed();
    setFactors([]);
    setInput('');
    setError(null);
    playSe('ui');
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-3.5">
      {/* 目標と、ここまで積み上げた積だけを表示する（残りは出さない） */}
      <div className="hud-corner relative overflow-hidden border border-cyan-300/25 bg-gradient-to-b from-cyan-950/40 to-black/60 px-4 py-3.5 sm:px-5">
        <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-fuchsia-500/15 blur-2xl" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="label mb-1 flex items-center gap-1.5 text-cyan-300/60">
              <span className="text-cyan-300/80">›</span> FACTORIZE // 積み上げ
            </div>
            <div className="jp text-[11px] text-slate-400">
              素数を1つずつ掛けて、目標の数とぴったり一致させよう
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-center border border-solar/40 bg-solar/8 px-3.5 py-1.5">
            <span className="label text-[8px] text-amber-200/70">目標の数</span>
            <span className="num text-[26px] leading-none font-black text-amber-300">
              {isCountdown ? '？？？' : value.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="mt-3 flex min-h-[38px] flex-wrap items-center gap-1.5">
          {isCountdown ? (
            <span className="jp text-[12px] text-slate-500">カウントダウン中…</span>
          ) : factors.length === 0 ? (
            <span className="jp text-[12px] text-slate-500">
              まだ何も積んでいません（素数を入力して Enter）
            </span>
          ) : (
            <span className="num flex flex-wrap items-center gap-1.5 text-[18px] font-black sm:text-[20px]">
              {factors.map((f, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-fuchsia-300">×</span>}
                  <span className="animate-pop border border-cyan-300/50 bg-cyan-400/15 px-2 py-0.5 text-cyan-100">
                    {f}
                  </span>
                </span>
              ))}
              <span className="text-slate-400">=</span>
              <span
                className={
                  over ? 'text-rose-400' : product === value ? 'text-emerald-300' : 'text-white'
                }
              >
                {product.toLocaleString()}
              </span>
              {over && (
                <span className="jp animate-pulse text-[11px] font-black text-rose-400">
                  目標オーバー
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* 入力（数字 → Enter で1つずつ） */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div key={shake} className={cn('flex items-stretch gap-2', shake > 0 && 'animate-shake')}>
          <input
            ref={inputRef}
            className="input num min-w-0 flex-1 text-center text-[22px] font-black tracking-widest"
            placeholder="素数を入力"
            inputMode="numeric"
            enterKeyHint="done"
            autoComplete="off"
            aria-label="素因数を1つ入力"
            value={input}
            disabled={locked}
            onChange={(e) => setInput(normalizeInput(e.target.value))}
            onKeyDown={(e) => {
              // 入力が空のときの Backspace は、直近に積んだ素数を1つ取り消す
              if (e.key === 'Backspace' && input === '' && factors.length > 0) {
                e.preventDefault();
                undo();
              }
            }}
          />
          <button
            type="submit"
            disabled={locked || normalizeInput(input) === ''}
            className="btn btn-primary shrink-0 px-5 text-[12px] disabled:opacity-30"
          >
            積む ↵
          </button>
        </div>
      </form>
      {lockRemain > 0 ? (
        <p className="jp flex items-center gap-1.5 text-[11px] font-bold text-rose-300">
          <IconLock size={12} />
          お手つき: あと {(lockRemain / 1000).toFixed(0)} 秒で入力できます
        </p>
      ) : error ? (
        <p className="jp text-[11px] font-bold text-rose-300">{error}</p>
      ) : over ? (
        <p className="jp text-[11px] font-bold text-rose-300">
          積が目標の {value.toLocaleString()}{' '}
          を超えています。Backspaceで直近の素数を1つ消すか、「最初から」で全リセットしてください。
        </p>
      ) : (
        <p className="jp text-[11px] text-slate-500">
          素数を Enter するたびに積へ積み上がります（例: 目標360なら 2↵ 2↵ 2↵ 3↵ 3↵ 5↵ で 2×2×2×3×3×5=360）。
          積が目標を超えたら赤く表示されます。Backspace（または「1つ戻す」）で直近の素数を1つ消せます。同じ素数を何度も使ってOK。
        </p>
      )}

      {/* 操作ボタン */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          onClick={undo}
          disabled={locked || factors.length === 0}
          className="gap-1.5 px-3 py-2.5 text-[10px]"
        >
          <IconUndo size={13} /> 1つ戻す（⌫）
        </Button>
        <div className="grow" />
        <Button
          variant="ghost"
          onClick={reset}
          disabled={locked || (factors.length === 0 && input === '')}
          className="gap-1.5 px-3 py-2.5 text-[10px]"
        >
          <IconReset size={13} /> 最初から
        </Button>
      </div>

      {/* パス（Make10と同じ扱い: 押しても解答権は失われない） */}
      {onPass && (
        <div className="mt-0.5 border-t border-white/10 pt-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {passed ? (
              <Button
                variant="ghost"
                className="gap-1.5 px-3 py-2 text-[10px]"
                disabled={!onCancelPass}
                onClick={() => {
                  playSe('ui');
                  onCancelPass?.();
                }}
              >
                <IconCheck size={13} /> パスを取り消す
              </Button>
            ) : (
              <Button
                variant="ghost"
                className="gap-1.5 px-3 py-2 text-[10px] text-slate-300"
                disabled={!canRequestPass}
                onClick={() => {
                  playSe('pass');
                  onPass?.();
                }}
              >
                <IconSkip size={13} /> パスする
              </Button>
            )}
            <span className="jp text-[11px] leading-relaxed text-slate-500">
              {passed
                ? 'パス中でも積み上げできます（入力すると取り消し）'
                : '解けないときはパス（押しただけでは解答権は失われません）'}
            </span>
          </div>
        </div>
      )}

      {disabled && disabledReason && (
        <div className="animate-float-up border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-center">
          <div className="jp text-[12px] font-bold text-emerald-100">{disabledReason}</div>
        </div>
      )}
    </div>
  );
}
