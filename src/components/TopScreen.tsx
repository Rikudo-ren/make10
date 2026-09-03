import { useState } from 'react';
import { Button, Card, inputCls } from './ui';

interface Props {
  busy: boolean;
  error: string | null;
  authError: string | null;
  onCreate: (name: string) => void;
  onJoin: (code: string, name: string) => void;
  onSolo: () => void;
}

export function TopScreen({ busy, error, authError, onCreate, onJoin, onSolo }: Props) {
  const [name, setName] = useState(() => localStorage.getItem('make10.name') ?? '');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'none' | 'join'>('none');

  const save = (n: string) => {
    setName(n);
    localStorage.setItem('make10.name', n);
  };

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-8 px-5 py-12">
      {/* 背景装飾 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="drift absolute -left-10 top-24 h-64 w-64 rounded-full bg-indigo-600/25 blur-3xl" />
        <div className="drift-slow absolute right-0 top-10 h-72 w-72 rounded-full bg-fuchsia-600/20 blur-3xl" />
        <div className="drift absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="grid-overlay absolute inset-0" />
      </div>

      {/* ヒーロー */}
      <div className="relative flex flex-col items-center gap-7 text-center lg:flex-row lg:justify-between lg:gap-12 lg:text-left">
        <div className="max-w-xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-4 py-1.5 text-[11px] font-black tracking-[.3em] text-indigo-200 backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            REALTIME PUZZLE BATTLE
          </div>
          <h1 className="text-6xl font-black leading-[0.95] tracking-tight sm:text-7xl">
            <span className="grad-white">メイク</span>
            <span className="grad-amber px-2 drop-shadow-[0_6px_24px_rgba(251,146,60,.4)]">10</span>
            <span className="grad-white">バトル</span>
          </h1>
          <p className="mt-5 text-sm leading-relaxed text-slate-400 sm:text-base">
            出された数字を四則演算で組み合わせて <b className="text-amber-300">「10」</b> を作れ。
            <br className="hidden sm:block" />
            友だちと<b className="text-indigo-300">同じ問題に同時挑戦</b>する、早解きリアルタイム対戦。
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2 lg:justify-start">
            <span className="chip">🎯 出題には必ず解あり</span>
            <span className="chip">⚡ 通信ラグ補正で公平判定</span>
            <span className="chip">📱 スマホで対戦OK</span>
          </div>
        </div>

        {/* 例題カード */}
        <div className="card w-full max-w-sm shrink-0 p-6">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[10px] font-black tracking-[.3em] text-indigo-300">
              HOW TO PLAY
            </span>
            <span className="chip border-amber-300/40 bg-amber-400/10 text-amber-200">
              TARGET <b className="ml-1 text-base">10</b>
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {['7', '3', '8', '2'].map((n, i) => (
              <div key={i} className="aspect-square">
                <span className="tile">{n}</span>
              </div>
            ))}
          </div>
          <div className="my-3 text-center text-xl font-black text-slate-600">▼</div>
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-center">
            <div className="text-[10px] font-black tracking-widest text-slate-500">解き方の例</div>
            <div className="mt-1 text-lg font-black tabular-nums text-amber-100">
              8 + ( 7 − 3 ) ÷ 2 <span className="text-amber-400">= 10</span>
            </div>
          </div>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-500">
            数字 → 演算子 → 数字、の順にタップで計算。<br />
            数字が1個になり <b className="text-amber-300">10</b> になったらクリア！
          </p>
        </div>
      </div>

      {/* 操作カード */}
      <Card accent className="relative mx-auto w-full max-w-2xl p-6 sm:p-8">
        <div className="glass-divider mb-6" />
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-black tracking-[.2em] text-indigo-200">ニックネーム</span>
          <input
            className={inputCls}
            placeholder="例：たろう"
            maxLength={16}
            value={name}
            onChange={(e) => save(e.target.value)}
          />
        </label>

        {mode === 'join' && (
          <label className="animate-float-up mt-4 flex flex-col gap-1.5">
            <span className="text-xs font-black tracking-[.2em] text-indigo-200">
              ルームコード（6文字）
            </span>
            <input
              className={`${inputCls} text-center text-3xl font-black tracking-[.5em] uppercase`}
              placeholder="ABC123"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </label>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Button
            variant="primary"
            disabled={busy || !name.trim()}
            onClick={() => onCreate(name.trim())}
            className="py-4 text-base"
          >
            🏠 <span>ルームを作る</span>
          </Button>
          {mode === 'join' ? (
            <Button
              variant="success"
              disabled={busy || !name.trim() || code.length < 4}
              onClick={() => onJoin(code, name.trim())}
              className="py-4 text-base"
            >
              🚪 このコードで参加
            </Button>
          ) : (
            <Button variant="soft" disabled={busy} onClick={() => setMode('join')} className="py-4 text-base">
              🚪 ルームに入る
            </Button>
          )}
        </div>

        <div className="my-5 flex items-center gap-3 text-[11px] font-bold tracking-widest text-slate-500">
          <div className="glass-divider grow" />
          または
          <div className="glass-divider grow" />
        </div>

        <Button variant="ghost" className="w-full" onClick={onSolo}>
          🧠 ひとり練習モード（オフライン）
        </Button>

        {(error || authError) && (
          <p className="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error ?? `接続エラー: ${authError}`}
          </p>
        )}
      </Card>

      <div className="relative text-center text-[11px] leading-relaxed text-slate-500">
        数字ボタン → 演算子 → もう1つの数字、の順にタップで計算。
        <br />
        出題される問題には必ず解が存在します（ソルバーによる事前チェック済み）。
      </div>
    </div>
  );
}
