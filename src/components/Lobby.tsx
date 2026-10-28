import { useState } from 'react';
import type { UseRoom } from '../lib/useRoom';
import { normalizeSettings } from '../lib/types';
import { SettingsPanel } from './SettingsPanel';
import { Button, Card, ConfirmDialog, SectionTitle } from './ui';
import { IconCheck, IconCopy, IconCrown, IconGear, IconPlay, IconUsers } from './icons';
import { TeamBadge } from './TeamBadge';
import { TEAM_DEFS } from '../lib/teams';
import { playSe } from '../lib/audio';
import { cn } from '../utils/cn';

export function Lobby({ ctrl }: { ctrl: UseRoom }) {
  const { room, players, isGM, uid, roomId } = ctrl;
  const [copied, setCopied] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  if (!room) return null;
  const settings = normalizeSettings(room.settings);
  const me = players.find((p) => p.uid === uid);
  const allReady = players.every((p) => p.isReady || p.uid === room.gmUid);
  const isTeam = settings.battleMode === 'team';
  // チーム戦は「全チームに最低1人」入る人数がそろわないと開始できない
  const teamPlayersEnough = !isTeam || players.length >= settings.teamCount;
  const canStart =
    isGM && players.length >= 1 && teamPlayersEnough && (!settings.requireAllReady || allReady);

  const copy = () => {
    navigator.clipboard?.writeText(roomId ?? '');
    playSe('ui');
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="relative mx-auto w-full max-w-6xl px-4 py-6 pb-24">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="grid-overlay absolute inset-0" />
        <div className="absolute -left-10 top-24 h-64 w-64 rounded-full ambient-cyan" />
        <div className="absolute right-0 top-10 h-64 w-64 rounded-full ambient-magenta" />
      </div>

      {/* ヘッダー */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="hud-corner relative border border-cyan-400/25 bg-cyan-500/5 px-5 py-3 backdrop-blur">
            <div className="label text-cyan-300/70">ROOM CODE</div>
            <button
              onClick={copy}
              className="num mt-0.5 flex items-center gap-3 text-[30px] leading-none font-black tracking-[0.25em] text-white transition hover:text-cyan-300"
              title="タップでコピー"
            >
              {roomId}
              <span className="text-cyan-300/80">
                {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
              </span>
            </button>
            <div className="jp mt-1 text-[10px] text-slate-400">
              {copied ? 'コピーしました' : 'タップでコピー・友だちに共有'}
            </div>
          </div>
          <div className="hidden flex-col gap-1 sm:flex">
            <span className="chip text-[9px] text-cyan-200/80">WAITING ROOM</span>
            <span className="jp text-[11px] text-slate-500">
              全員の準備ができたらゲーム開始
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isGM && (
            <Button
              variant={me?.isReady ? 'primary' : 'soft'}
              onClick={() => {
                playSe('toggle');
                ctrl.setReady(!me?.isReady);
              }}
              className="gap-1.5 py-3"
            >
              <IconCheck size={13} />
              {me?.isReady ? '準備OK' : '準備する'}
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => (isGM ? setLeaveConfirm(true) : ctrl.leaveRoom())}
            className="py-3"
          >
            退出
          </Button>
        </div>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-[300px_1fr]">
        <div className="flex flex-col gap-3.5">
          <Card>
            <div className="mb-2.5 flex items-center justify-between">
              <SectionTitle icon={<IconUsers size={13} />}>PLAYERS</SectionTitle>
              <span className="num text-[12px] text-cyan-200/70">{players.length}</span>
            </div>
            <ul className="space-y-1.5">
              {players.map((p) => (
                <li
                  key={p.uid}
                  className={cn(
                    'flex items-center justify-between gap-2 border-l-2 px-2.5 py-2',
                    p.uid === uid ? 'border-cyan-300/90 bg-cyan-400/8' : 'border-white/12 bg-black/25',
                  )}
                >
                  <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-[12px] font-bold text-white">
                    {p.uid === room.gmUid && <IconCrown size={12} className="shrink-0 text-amber-300" />}
                    <span className="break-words" style={{ overflowWrap: 'anywhere' }}>{p.name}</span>
                    {p.uid === uid && (
                      <span className="shrink-0 text-[8px] tracking-wider text-cyan-300/80">YOU</span>
                    )}
                    {isTeam && <TeamBadge teamId={p.teamId} size="sm" />}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {isTeam && isGM && settings.teamAssignMode === 'manual' && (
                      <select
                        className="input w-[86px] shrink-0 px-1.5 py-1 text-[10px]"
                        value={p.teamId ?? ''}
                        aria-label={`${p.name}のチーム`}
                        onChange={(e) =>
                          ctrl.setPlayerTeam(
                            p.uid,
                            e.target.value === '' ? null : Number(e.target.value),
                          )
                        }
                      >
                        <option value="">未定</option>
                        {TEAM_DEFS.slice(0, settings.teamCount).map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    )}
                    <span
                      className={cn(
                        'shrink-0 text-[9px] font-bold tracking-wider',
                        p.uid === room.gmUid
                          ? 'text-amber-300'
                          : p.isReady
                            ? 'text-emerald-300'
                            : 'text-slate-500',
                      )}
                    >
                      {p.uid === room.gmUid ? 'HOST' : p.isReady ? 'READY' : 'STANDBY'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            {isTeam && (
              <div className="mt-3 border border-white/10 bg-white/[0.03] p-2.5">
                <div className="label jp mb-1.5 text-[9px] tracking-[.18em] text-slate-400">
                  TEAMS // {settings.teamCount}チーム・
                  {settings.teamAssignMode === 'manual'
                    ? 'GM手動'
                    : settings.teamAssignMode === 'random'
                      ? 'ランダム'
                      : 'バランス'}
                </div>
                <div className="space-y-1">
                  {TEAM_DEFS.slice(0, settings.teamCount).map((t) => {
                    const members = players.filter((p) => p.teamId === t.id);
                    return (
                      <div key={t.id} className="jp flex flex-wrap items-baseline gap-x-1.5 text-[10px] leading-relaxed">
                        <span className="font-black" style={{ color: t.color }}>{t.label}</span>
                        <span className="text-slate-400">
                          {members.length > 0 ? members.map((m) => m.name).join('、') : '（未定）'}
                        </span>
                      </div>
                    );
                  })}
                  {players.some((p) => p.teamId == null) && (
                    <div className="jp text-[10px] text-slate-500">
                      未所属: {players.filter((p) => p.teamId == null).map((m) => m.name).join('、')}
                    </div>
                  )}
                </div>
                {isGM && settings.teamAssignMode !== 'manual' && (
                  <Button
                    variant="ghost"
                    className="mt-2 w-full py-2 text-[10px]"
                    onClick={() => {
                      playSe('toggle');
                      void ctrl.assignTeamsNow();
                    }}
                  >
                    {settings.teamAssignMode === 'random' ? 'チームを振り分ける（振り直し可）' : 'チームを振り分ける'}
                  </Button>
                )}
                {isGM && settings.teamAssignMode === 'manual' && (
                  <p className="jp mt-1.5 text-[9px] leading-relaxed text-slate-500">
                    各プレイヤー右のプルダウンで所属を選んでください。未定の人は開始時に自動で補充されます。
                  </p>
                )}
                {!teamPlayersEnough && (
                  <p className="jp mt-1.5 text-[10px] font-bold text-amber-300">
                    チーム戦は{settings.teamCount}人以上そろわないと開始できません
                  </p>
                )}
              </div>
            )}
            {isGM && (
              <Button
                className="mt-3.5 w-full gap-2 py-3.5"
                disabled={!canStart}
                onClick={ctrl.startMatch}
              >
                <IconPlay size={13} />
                ゲーム開始（{settings.roundCount}問）
              </Button>
            )}
            {isGM && settings.requireAllReady && !allReady && (
              <p className="jp mt-2 text-center text-[10px] text-amber-300">全員の準備完了待ちです</p>
            )}
            {!isGM && (
              <p className="jp mt-3.5 text-center text-[10px] text-slate-400">
                GMが開始するのを待っています…
              </p>
            )}
          </Card>
        </div>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <SectionTitle icon={<IconGear size={13} />}>
              {isGM ? 'MATCH SETTINGS' : 'MATCH SETTINGS // READONLY'}
            </SectionTitle>
            {!isGM && <span className="label text-slate-600">GM ONLY</span>}
          </div>
          <SettingsPanel
            settings={settings}
            readOnly={!isGM}
            onChange={(patch) => ctrl.updateSettings(patch)}
          />
        </Card>
      </div>

      {ctrl.error && (
        <p className="jp mt-4 border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200">
          {ctrl.error}
        </p>
      )}

      <ConfirmDialog
        open={leaveConfirm}
        title="ルームを解散しますか？"
        description={
          <>
            GMが退出すると<b className="text-rose-300">ルームは削除されます</b>。
            参加者全員が退出し、チャット・スコア・履歴も残りません。
          </>
        }
        confirmLabel="解散して退出"
        cancelLabel="やめる"
        onConfirm={() => {
          setLeaveConfirm(false);
          ctrl.leaveRoom();
        }}
        onCancel={() => setLeaveConfirm(false)}
      />
    </div>
  );
}
