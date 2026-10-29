import { useEffect, useRef, useState } from 'react';
import { Button } from './ui';
import { IconCheck, IconLock, IconReset, IconSkip, IconUndo } from './icons';
import { playSe } from '../lib/audio';
import { cn } from '../utils/cn';
import {
  checkFactorDivideStep,
  checkFactorStep,
  FACTOR_GUESS_ERROR_TEXT,
  factorFormula,
  factorKey,
  productOf,
  type FactorGuessError,
  type FactorStyle,
} from '../lib/factor';

interface Props {
  /** 分解する合成数 */
  value: number;
  /** 進め方: 'accumulate' 積み上げ式 / 'divide' 割り算式（目標が割れていく） */
  factorStyle?: FactorStyle;
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
  factorStyle = 'accumulate',
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
  const isDivide = factorStyle === 'divide';
  /** 割り算式での残りの数（割り切れる素数だけが積まれるので常に割り切れる） */
  const remaining = isDivide ? value / product : value;
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

  // 問題開始（カウントダウン終了）直後は入力欄へ自動フォーカスし、
  // すぐ物理キーボードで打ち始められるようにする
  useEffect(() => {
    if (isCountdown || disabled) return;
    inputRef.current?.focus();
  }, [value, roundKey, isCountdown, disabled]);

  // 物理キーボード対応: 入力欄以外にフォーカスがあるときでも数字・Backspace・Enterを受け付ける
  // （チャット欄など他の入力欄で打っているときは奪わない。依存なしで常に最新の状態を参照する）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (locked || solvedRef.current) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const inOurInput = !!t && t === inputRef.current;
      if (t && !inOurInput) {
        const tag = t.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) {
          return;
        }
      }
      if (/^[0-9]$/.test(e.key)) {
        if (inOurInput) return; // 入力欄自身が処理する
        e.preventDefault();
        pressDigit(e.key);
      } else if (e.key === 'Backspace') {
        if (inOurInput) return; // 入力欄の onKeyDown（空なら直近の素数を消す）が処理する
        e.preventDefault();
        backspace();
      } else if (e.key === 'Enter') {
        if (inOurInput) return; // フォーム送信が処理する
        if (t && t.tagName === 'BUTTON') return; // ボタン上のEnterはボタンの動作を優先
        e.preventDefault();
        submit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const over = !isDivide && product > value;
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

    const failStep = (reason: FactorGuessError) => {
      fail(
        reason === 'not-prime'
          ? `${text || 'その数'} は素数ではありません。素数を入力してください`
          : reason === 'not-a-factor'
            ? `${parsed} は ${remaining.toLocaleString()} に含まれる素因数ではありません`
            : FACTOR_GUESS_ERROR_TEXT[reason],
      );
    };

    const stackPrime = (v: number, solved: boolean) => {
      resumeIfPassed();
      const nextFactors = [...factors, v];
      setFactors(nextFactors);
      setInput('');
      setError(null);
      inputRef.current?.focus();
      if (solved) {
        solvedRef.current = true;
        playSe('correct');
        onSolved(factorFormula(nextFactors), factorKey(nextFactors));
      } else {
        playSe('calc');
      }
    };

    if (isDivide) {
      // 割り算式: 残りを割り切れる素数だけが入り、残りが1になったら完了
      const result = checkFactorDivideStep({ remaining, value: parsed });
      if (!result.ok) {
        failStep(result.reason);
        return;
      }
      stackPrime(result.value, result.nextRemaining === 1);
      return;
    }

    // 積み上げ式: 素数なら必ず積む（オーバーは赤表示で知らせる）
    const result = checkFactorStep({ target: value, currentProduct: product, value: parsed });
    if (!result.ok) {
      failStep(result.reason);
      return;
    }
    stackPrime(result.value, result.nextProduct === value);
  };

  const undo = () => {
    if (locked || factors.length === 0) return;
    resumeIfPassed();
    setFactors(factors.slice(0, -1));
    setError(null);
    playSe('ui');
    inputRef.current?.focus();
  };

  /** 画面キーパッド: 数字を1文字足す */
  const pressDigit = (d: string) => {
    if (locked || solvedRef.current) return;
    resumeIfPassed();
    setInput((prev) => normalizeInput(prev + d).slice(0, 10));
    setError(null);
  };

  /** ⌫ボタン: 入力中なら1文字消し、入力が空なら直近に積んだ素数を1つ消す */
  const backspace = () => {
    if (locked || solvedRef.current) return;
    if (input !== '') {
      resumeIfPassed();
      setInput(input.slice(0, -1));
      setError(null);
      playSe('ui');
    } else {
      undo();
    }
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
      {/* 目標の数を大きく中央に表示し、その下に積み上げた式を出す（残りは出さない） */}
      <div className="hud-corner relative overflow-hidden border border-cyan-300/25 bg-gradient-to-b from-cyan-950/40 to-black/60 px-4 py-4 sm:px-5">
        <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-fuchsia-500/15 blur-2xl" />
        <div className="relative text-center">
          <div className="label flex items-center justify-center gap-1.5 text-cyan-300/60">
            <span className="text-cyan-300/80">›</span> FACTORIZE // {isDivide ? '割り算' : '積み上げ'}
          </div>
          <div className="label mt-2.5 text-[10px] tracking-[.35em] text-amber-200/70">
            {isDivide ? '残りの数' : '分解する数'}
          </div>
          <div className="num mt-1 text-[56px] leading-none font-black text-amber-300 [text-shadow:0_0_28px_rgba(251,191,36,.35)] sm:text-[72px]">
            {isCountdown ? '？？？' : (isDivide ? remaining : value).toLocaleString()}
          </div>
          <div className="jp mt-2.5 text-[11px] text-slate-400">
            {isDivide
              ? `目標の数 ${value.toLocaleString()} を素数で割っていって、残りの数を1にしよう`
              : '素数を1つずつ掛けて、この数とぴったり一致させよう'}
          </div>
        </div>

        <div className="mt-4 flex min-h-[46px] flex-wrap items-center justify-center gap-1.5 border-t border-white/10 pt-3.5">
          {isCountdown ? (
            <span className="jp text-[12px] text-slate-500">カウントダウン中…</span>
          ) : factors.length === 0 ? (
            <span className="jp text-[12px] text-slate-500">
              {isDivide
                ? 'まだ割っていません（素数を入力して Enter）'
                : 'まだ何も積んでいません（素数を入力して Enter）'}
            </span>
          ) : (
            <span className="num flex flex-wrap items-center justify-center gap-1.5 text-[20px] font-black sm:text-[24px]">
              {factors.map((f, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-fuchsia-300">×</span>}
                  <span className="animate-pop border border-cyan-300/50 bg-cyan-400/15 px-2.5 py-1 text-cyan-100">
                    {f}
                  </span>
                </span>
              ))}
              {isDivide ? (
                remaining > 1 && (
                  <span className="flex items-center gap-1.5">
                    <span className="text-fuchsia-300">×</span>
                    <span className="border border-dashed border-amber-300/60 bg-amber-400/10 px-2.5 py-1 text-amber-200">
                      {remaining.toLocaleString()}
                    </span>
                  </span>
                )
              ) : (
                <>
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
                </>
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

      {/* 画面キーパッド（0〜9＋⌫）。101などの3桁素数も打てるよう0も含む */}
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            type="button"
            disabled={locked}
            onClick={() => pressDigit(d)}
            className="num border border-cyan-300/25 bg-cyan-400/10 py-3 text-[18px] font-black text-cyan-100 transition hover:bg-cyan-400/20 active:scale-95 disabled:opacity-30"
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          disabled={locked}
          onClick={() => pressDigit('0')}
          className="num col-span-2 border border-cyan-300/25 bg-cyan-400/10 py-3 text-[18px] font-black text-cyan-100 transition hover:bg-cyan-400/20 active:scale-95 disabled:opacity-30"
        >
          0
        </button>
        <button
          type="button"
          disabled={locked || (input === '' && factors.length === 0)}
          onClick={backspace}
          aria-label="1文字消す（入力が空のときは直近の素数を1つ消す）"
          title="1文字消す（入力が空のときは直近の素数を1つ消す）"
          className="num border border-white/20 bg-white/5 py-3 text-[18px] font-black text-slate-200 transition hover:bg-white/10 active:scale-95 disabled:opacity-30"
        >
          ⌫
        </button>
      </div>

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
          {isDivide
            ? '素数を Enter するたびに残りの数が割れていきます。残りの数を割り切れない素数は入りません。Backspace（⌫）で直近の素数を1つ戻せます。同じ素数を何度も使ってOK。'
            : '素数を Enter するたびに積へ積み上がります（例: 目標360なら 2↵ 2↵ 2↵ 3↵ 3↵ 5↵ で 2×2×2×3×3×5=360）。積が目標を超えたら赤く表示されます。Backspace（⌫）で直近の素数を1つ消せます。同じ素数を何度も使ってOK。'}
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
