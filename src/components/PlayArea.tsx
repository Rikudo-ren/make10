import { useEffect, useRef, useState } from 'react';
import { useBoard } from '../lib/board';
import { EPS, OP_SYMBOL, displayValue, type Op } from '../lib/solver';
import { Button } from './ui';
import { IconAlert, IconCheck, IconLock, IconRedo, IconReset, IconSkip, IconUndo } from './icons';
import { playSe } from '../lib/audio';
import { cn } from '../utils/cn';

interface Props {
  numbers: number[];
  target: number;
  allowedOperators: Op[];
  integerOnly: boolean;
  disabled?: boolean;
  disabledReason?: string;
  penaltyMode: 'none' | 'lock';
  /** formula: 表示用の式文字列 / key: 解答例との照合に使う等価判定キー */
  onSolved: (formula: string, key: string) => void;
  onPass?: () => void;
  /** パスの取り消し（ラウンド中のみ有効） */
  onCancelPass?: () => void;
  /** パス中でも解答はできる（数字を触ったらパスを取り消す） */
  passed?: boolean;
  isCountdown?: boolean;
  /** 出題が変わったことを検知するためのキー（数字が同じでも次の問題なら盤面をリセット） */
  roundKey?: string | number;
}

export function PlayArea({
  numbers,
  target,
  allowedOperators,
  integerOnly,
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
  // 「数字が同じで目標値だけ違う次の問題」でも盤面を必ず作り直す
  const boardKey = `${numbers.join(',')}|${target}|${roundKey ?? ''}`;
  const board = useBoard(numbers, integerOnly, boardKey);
  // お手つきロックは問題が変わったら無効（前ラウンドの残り時間を引き継がない）
  const [lockState, setLockState] = useState<{ key: string; until: number }>({ key: '', until: 0 });
  const [now, setNow] = useState(Date.now());
  const [wrongShake, setWrongShake] = useState(0);
  const solvedRef = useRef<string | null>(null);
  const resumeRequestedRef = useRef(false);
  const lastFlash = useRef(0);
  const wasFinished = useRef(false);

  // 計算を確定させた瞬間（=1つにまとまったとき）の効果音
  useEffect(() => {
    if (board.finished && !wasFinished.current) playSe('calc');
    wasFinished.current = board.finished;
  }, [board.finished]);

  useEffect(() => {
    solvedRef.current = null;
    setWrongShake(0);
  }, [boardKey]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!board.finished || board.finalValue === null) return;
    if (Math.abs(board.finalValue - target) < EPS) {
      if (solvedRef.current !== board.finalFormula) {
        solvedRef.current = board.finalFormula;
        playSe('correct');
        onSolved(board.finalFormula, board.finalKey);
      }
    } else {
      setWrongShake((w) => w + 1);
      playSe('wrong');
      if (penaltyMode === 'lock') setLockState({ key: boardKey, until: Date.now() + 5000 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.finished, board.finalFormula, board.finalValue, target]);

  // 計算できない操作（0除算・整数制限）は「お手つき」音
  useEffect(() => {
    if (board.flash > lastFlash.current) playSe('wrong');
    lastFlash.current = board.flash;
  }, [board.flash]);

  const lockRemain = lockState.key === boardKey ? Math.max(0, lockState.until - now) : 0;
  // パス中でも解き直せる（パスは「降参の意思表示」であって解答権の放棄ではない）
  const locked = !!disabled || lockRemain > 0 || !!isCountdown;
  const wrongFinished =
    board.finished && board.finalValue !== null && Math.abs(board.finalValue - target) >= EPS;
  const penaltyText = penaltyMode === 'lock' ? '誤答時は5秒間入力ロック' : 'ペナルティなし';
  const canRequestPass = !!onPass && !passed && !disabled && !isCountdown;
  /** パス中に操作したら「やっぱり解く」とみなしてパスを取り消す */
  const resumeIfPassed = () => {
    if (!passed || !onCancelPass || resumeRequestedRef.current) return;
    resumeRequestedRef.current = true;
    onCancelPass();
  };

  useEffect(() => {
    if (!passed) resumeRequestedRef.current = false;
  }, [passed]);

  return (
    <div className="flex flex-col gap-3.5">
      {/* 式表示エリア（ターミナル風） */}
      <div className="hud-corner relative overflow-hidden border border-cyan-300/25 bg-gradient-to-b from-cyan-950/40 to-black/60 px-4 py-3.5 sm:px-5">
        <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-cyan-500/15 blur-2xl" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="label mb-1 flex items-center gap-1.5 text-cyan-300/60">
              <span className="text-cyan-300/80">›</span> EXPRESSION
            </div>
            <div
              key={board.flash + '-' + wrongShake}
              className={cn(
                'num min-h-[34px] truncate text-[22px] font-bold text-white sm:text-[27px]',
                (board.flash > 0 || wrongShake > 0) && 'animate-shake',
              )}
              style={{ textShadow: '0 0 22px rgba(34,224,255,.35)' }}
            >
              {isCountdown ? (
                <span className="jp font-ui text-sm font-bold text-slate-500">カウントダウン中…</span>
              ) : board.finished ? (
                board.finalFormula
              ) : board.pendingText ? (
                board.pendingText
              ) : (
                <span className="jp font-ui text-sm font-bold text-slate-500">数字を選んでください</span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-center border border-solar/40 bg-solar/8 px-3.5 py-1.5">
            <span className="label text-[8px] text-amber-200/70">TARGET</span>
            <span className="num text-[26px] leading-none font-black text-amber-300 glow-magenta">
              {target}
            </span>
          </div>
        </div>
        {wrongFinished && !isCountdown && (
          <div className="jp mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-rose-300">
            <IconAlert size={12} />
            結果 {displayValue(board.finalValue!)} … {target} になりませんでした
            {lockRemain > 0 && (
              <span className="text-rose-300/70">／ あと {(lockRemain / 1000).toFixed(0)}秒で解除</span>
            )}
          </div>
        )}
      </div>

      {/* 数字タイル（固定グリッド・空スロットも固定） */}
      <div className="grid grid-cols-4 gap-2.5 sm:gap-3.5">
        {board.slots.map((slot) => (
          <div key={slot.id} className="relative aspect-square">
            {slot.tile ? (
              <button
                disabled={locked}
                onClick={() => {
                  playSe('tile');
                  resumeIfPassed();
                  board.tapNumber(slot.id);
                }}
                className={cn(
                  'tile animate-pop',
                  slot.id === board.selectedSlot && 'tile-selected',
                  isCountdown && 'text-white/20',
                )}
              >
                {isCountdown ? '?' : displayValue(slot.tile.expr.rat)}
              </button>
            ) : (
              <div className="absolute inset-0 border border-dashed border-white/8 bg-white/[0.015]" />
            )}
          </div>
        ))}
      </div>

      {/* 演算子 */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {(['+', '-', '*', '/'] as Op[]).map((op) => {
          const allowed = allowedOperators.includes(op);
          const active = board.pendingOp === op;
          return (
            <button
              key={op}
              disabled={locked || !allowed || board.selectedSlot === null}
              onClick={() => {
                playSe('op');
                resumeIfPassed();
                board.tapOp(op);
              }}
              className={cn('op-btn py-3.5 sm:py-4', active && 'op-btn-active')}
            >
              {OP_SYMBOL[op]}
            </button>
          );
        })}
      </div>

      {/* 操作ボタン */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          onClick={() => {
            playSe('ui');
            board.undo();
          }}
          disabled={!board.canUndo || locked}
          className="gap-1.5 px-3 py-2.5 text-[10px]"
        >
          <IconUndo size={13} /> 1手戻す
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            playSe('ui');
            board.redo();
          }}
          disabled={!board.canRedo || locked}
          className="gap-1.5 px-3 py-2.5 text-[10px]"
        >
          <IconRedo size={13} /> やり直す
        </Button>
        <div className="grow" />
        <Button
          variant="ghost"
          onClick={() => {
            playSe('ui');
            board.reset();
          }}
          disabled={locked}
          className="gap-1.5 px-3 py-2.5 text-[10px]"
          title="式を出題時の状態まで一気に戻します"
        >
          <IconReset size={13} /> 全リセット
        </Button>
      </div>

      {/* パス: 画面の左側に置き、全リセット（右下）からできるだけ離す。確認ダイアログは出さない */}
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
                title="ラウンドが終了していなければ解答に戻れます"
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
                title="未正解の人が全員パスするとラウンド終了になります"
              >
                <IconSkip size={13} /> パスする
              </Button>
            )}
            <span className="jp text-[11px] leading-relaxed text-slate-500">
              {passed
                ? 'パス中でも解答できます（数字を触ると取り消し）'
                : '解けないときはパス（押しただけでは解答権は失われません）'}
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
        <span className="jp flex items-center gap-1.5">
          <kbd className="kbd">BACKSPACE</kbd>
          でも1手戻せます
        </span>
        <span className="jp flex items-center gap-1 font-bold">
          <IconLock size={11} /> {penaltyText}
        </span>
      </div>

      {disabled && disabledReason && (
        <div className="animate-float-up border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-center">
          <div className="jp text-[12px] font-bold text-emerald-100">{disabledReason}</div>
        </div>
      )}
    </div>
  );
}
