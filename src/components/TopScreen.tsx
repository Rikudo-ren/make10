import { useState } from 'react';
import { Button, Icon, Rule, inputCls } from './ui';

interface Props {
  busy: boolean;
  error: string | null;
  authError: string | null;
  onCreate: (name: string) => void;
  onJoin: (code: string, name: string) => void;
  onSolo: () => void;
}

const SAMPLE = ['7', '3', '8', '2'];

export function TopScreen({ busy, error, authError, onCreate, onJoin, onSolo }: Props) {
  const [name, setName] = useState(() => localStorage.getItem('make10.name') ?? '');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'none' | 'join'>('none');

  const save = (n: string) => {
    setName(n);
    localStorage.setItem('make10.name', n);
  };

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-10 px-5 py-14">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="grid-overlay absolute inset-0" />
        <div className="absolute left-1/2 top-0 h-[420px] w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-[rgba(194,42,69,0.35)] to-transparent" />
      </div>

      {/* ヒーロー */}
      <div className="relative grid gap-10 lg:grid-cols-[1fr_360px] lg:items-center lg:gap-14">
        <div>
          <div className="flex items-center gap-3">
            <span className="h-1.5 w-1.5 animate-breathe bg-cyber" />
            <span className="eyebrow">Realtime Numeral Duel</span>
          </div>

          <h1 className="mt-5 flex items-end gap-3">
            <span className="ink-title display text-[3.5rem] leading-[0.85] tracking-[0.01em] sm:text-[5rem]">
              メイク
            </span>
            <span className="blood-title display text-[4.2rem] leading-[0.8] tracking-[-0.02em] sm:text-[6rem]">
              10
            </span>
          </h1>
          <div className="mt-3 flex items-center gap-4">
            <span className="display text-[1.05rem] tracking-[0.55em] text-bone-dim">バトル</span>
            <span className="h-px flex-1 bg-[var(--hair)]" />
            <span className="numeral text-[10px] tracking-[0.3em] text-bone-faint">MNEMO-10</span>
          </div>

          <p className="mt-6 max-w-md text-[13px] leading-[1.9] text-bone-dim">
            配られた数字を四則演算で束ね、目標値
            <span className="numeral mx-1 text-brass">TARGET</span>
            を作れ。
            <br />
            同じ問題に同時に挑み、最も早く式を閉じた者が勝つ。
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="chip">必ず解あり</span>
            <span className="chip">通信ラグ補正</span>
            <span className="chip">ルームは24時間で消滅</span>
          </div>
        </div>

        {/* 例題 */}
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <span className="eyebrow">How to play</span>
            <span className="numeral text-[10px] tracking-[0.28em] text-bone-faint">EX.01</span>
          </div>

          <div className="mt-5 grid grid-cols-4 gap-2">
            {SAMPLE.map((n, i) => (
              <div key={i} className="aspect-square">
                <span className="tile cursor-default">{n}</span>
              </div>
            ))}
          </div>

          <div className="my-4 flex items-center gap-2 text-bone-faint">
            <span className="h-px flex-1 bg-[var(--hair)]" />
            <Icon name="target" className="h-3.5 w-3.5" />
            <span className="h-px flex-1 bg-[var(--hair)]" />
          </div>

          <div className="border border-[var(--hair)] bg-black/40 px-4 py-3.5 text-center">
            <div className="eyebrow mb-1.5">Solution</div>
            <div className="display text-[19px] text-bone">
              8 + ( 7 − 3 ) ÷ 2
              <span className="numeral ml-2 text-[13px] text-brass">= 10</span>
            </div>
          </div>

          <p className="mt-4 text-[11px] leading-[1.8] text-bone-faint">
            数字 → 演算子 → 数字 の順に選択。数字が1枚になれば確定。
          </p>
        </div>
      </div>

      <Rule />

      {/* 操作 */}
      <div className="card relative mx-auto w-full max-w-2xl p-6 sm:p-8">
        <label className="flex flex-col gap-1.5">
          <span className="eyebrow tracking-[0.24em]">Nickname</span>
          <input
            className={inputCls}
            placeholder="たろう"
            maxLength={16}
            value={name}
            onChange={(e) => save(e.target.value)}
          />
        </label>

        {mode === 'join' && (
          <label className="animate-rise mt-4 flex flex-col gap-1.5">
            <span className="eyebrow tracking-[0.24em]">Room code / 6 characters</span>
            <input
              className={`${inputCls} numeral text-center text-2xl uppercase tracking-[0.6em]`}
              placeholder="ABC123"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </label>
        )}

        <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
          <Button
            variant="primary"
            disabled={busy || !name.trim()}
            onClick={() => onCreate(name.trim())}
            className="py-3.5"
          >
            <Icon name="plus" />
            <span>ルームを作る</span>
          </Button>
          {mode === 'join' ? (
            <Button
              variant="amber"
              disabled={busy || !name.trim() || code.length < 4}
              onClick={() => onJoin(code, name.trim())}
              className="py-3.5"
            >
              <Icon name="enter" />
              <span>このコードで参加</span>
            </Button>
          ) : (
            <Button variant="soft" disabled={busy} onClick={() => setMode('join')} className="py-3.5">
              <Icon name="enter" />
              <span>ルームに入る</span>
            </Button>
          )}
        </div>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-[var(--hair)]" />
          <span className="eyebrow">or</span>
          <span className="h-px flex-1 bg-[var(--hair)]" />
        </div>

        <Button variant="ghost" className="w-full py-3" onClick={onSolo}>
          <Icon name="spark" />
          <span>ひとり練習（オフライン）</span>
        </Button>

        {(error || authError) && (
          <div className="mt-5 flex items-start gap-2 border-l-2 border-blood bg-blood/10 px-3.5 py-2.5 text-[12px] leading-relaxed text-[#ffb3bd]">
            <Icon name="alert" className="mt-0.5" />
            <span>{error ?? `接続エラー: ${authError}`}</span>
          </div>
        )}
      </div>

      <div className="relative text-center">
        <p className="numeral text-[10px] leading-[2] tracking-[0.18em] text-bone-faint">
          MAKE TEN / ALL PUZZLES VERIFIED SOLVABLE
          <br />
          ROOMS, SCORES AND RECORDS EXPIRE IN 24 HOURS
        </p>
      </div>
    </div>
  );
}
