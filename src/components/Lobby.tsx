import { useState } from 'react';
import type { UseRoom } from '../lib/useRoom';
import { normalizeSettings } from '../lib/types';
import { SettingsPanel } from './SettingsPanel';
import { Button, Card } from './ui';
import { cn } from '../utils/cn';

export function Lobby({ ctrl }: { ctrl: UseRoom }) {
  const { room, players, isGM, uid, roomId } = ctrl;
  const [copied, setCopied] = useState(false);
  if (!room) return null;
  const settings = normalizeSettings(room.settings);
  const me = players.find((p) => p.uid === uid);
  const allReady = players.every((p) => p.isReady || p.uid === room.gmUid);
  const canStart = isGM && players.length >= 1 && (!settings.requireAllReady || allReady);

  return (
    <div className="relative mx-auto w-full max-w-5xl px-4 py-6">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="grid-overlay absolute inset-0" />
        <div className="drift absolute -left-10 top-24 h-64 w-64 rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="drift-slow absolute right-0 top-10 h-64 w-64 rounded-full bg-fuchsia-600/12 blur-3xl" />
      </div>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="rounded-3xl border border-indigo-400/25 bg-indigo-500/10 px-6 py-4 backdrop-blur">
          <div className="text-[10px] font-black tracking-[.3em] text-indigo-300">ROOM CODE</div>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(roomId ?? '');
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="mt-0.5 text-4xl font-black tracking-[0.3em] text-white transition hover:text-indigo-300"
            title="タップでコピー"
          >
            {roomId}
          </button>
          <div className="mt-0.5 text-xs text-slate-400">
            {copied ? '✅ コピーしました！' : 'タップでコピー・友だちに共有しよう'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isGM && (
            <Button variant={me?.isReady ? 'success' : 'soft'} onClick={() => ctrl.setReady(!me?.isReady)}>
              {me?.isReady ? '✅ 準備OK' : '準備する'}
            </Button>
          )}
          <Button variant="ghost" onClick={ctrl.leaveRoom}>
            退出
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-black tracking-widest text-indigo-200">参加者</h2>
            <span className="text-xs text-slate-400">{players.length}人</span>
          </div>
          <ul className="space-y-2">
            {players.map((p) => (
              <li
                key={p.uid}
                className={cn(
                  'flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2',
                  p.uid === uid && 'border-indigo-400/50 bg-indigo-500/10',
                )}
              >
                <span className="flex items-center gap-2 text-sm font-bold text-white">
                  {p.uid === room.gmUid && <span title="ゲームマスター">👑</span>}
                  {p.name}
                  {p.uid === uid && <span className="text-[10px] text-indigo-300">(you)</span>}
                </span>
                <span className="text-[11px] text-slate-400">
                  {p.uid === room.gmUid ? 'GM' : p.isReady ? '準備OK' : '待機中'}
          </span>
        </li>
      ))}
    </ul>
    {isGM && (
      <Button className="mt-4 w-full" disabled={!canStart} onClick={ctrl.startMatch}>
              ▶ ゲーム開始（{settings.roundCount}問）
            </Button>
          )}
          {isGM && settings.requireAllReady && !allReady && (
            <p className="mt-2 text-center text-[11px] text-amber-300">全員の準備完了待ちです</p>
          )}
          {!isGM && (
            <p className="mt-4 text-center text-[11px] text-slate-400">
              GMが開始するのを待っています…
            </p>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-black tracking-widest text-indigo-200">GM設定</h2>
          <SettingsPanel
            settings={settings}
            readOnly={!isGM}
            onChange={(patch) => ctrl.updateSettings(patch)}
          />
        </Card>
      </div>
      {ctrl.error && (
        <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {ctrl.error}
        </p>
      )}
    </div>
  );
}
