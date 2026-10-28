import { useState } from 'react';
import type { UseRoom } from '../lib/useRoom';
import { normalizeSettings } from '../lib/types';
import { SettingsPanel } from './SettingsPanel';
import { ChatPanel } from './ChatPanel';
import { Button, Card, ConfirmDialog, Icon, Rule, SectionTitle } from './ui';
import { cn } from '../utils/cn';

export function Lobby({ ctrl }: { ctrl: UseRoom }) {
  const { room, players, isGM, uid, roomId } = ctrl;
  const [copied, setCopied] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  if (!room) return null;
  const settings = normalizeSettings(room.settings);
  const me = players.find((p) => p.uid === uid);
  const allReady = players.every((p) => p.isReady || p.uid === room.gmUid);
  const canStart = isGM && players.length >= 1 && (!settings.requireAllReady || allReady);

  const copyCode = () => {
    navigator.clipboard?.writeText(roomId ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="grid-overlay absolute inset-0" />
      </div>

      {/* ヘッダー */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-5">
        <div>
          <span className="eyebrow">Standby room</span>
          <button
            onClick={copyCode}
            className="group mt-2 flex items-center gap-3 text-left"
            title="タップでコピー"
          >
            <span className="display text-[2.2rem] leading-none tracking-[0.28em] text-bone transition-colors group-hover:text-brass sm:text-[2.7rem]">
              {roomId}
            </span>
            <Icon
              name={copied ? 'check' : 'copy'}
              className={cn('h-4 w-4 transition', copied ? 'text-cyber' : 'text-bone-faint')}
            />
          </button>
          <p className="mt-1.5 text-[11px] text-bone-faint">
            {copied ? 'コードをコピーしました' : 'タップでコピーして共有'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isGM && (
            <Button
              variant={me?.isReady ? 'success' : 'soft'}
              onClick={() => ctrl.setReady(!me?.isReady)}
              className="py-2.5"
            >
              <Icon name="check" className="h-3.5 w-3.5" />
              <span>{me?.isReady ? '準備完了' : '準備する'}</span>
            </Button>
          )}
          <Button
            variant="ghost"
            className="border border-[var(--hair)] py-2.5 text-bone-dim"
            onClick={() => (isGM ? setLeaveConfirm(true) : ctrl.leaveRoom())}
          >
            <Icon name="exit" className="h-3.5 w-3.5" />
            <span>{isGM ? '解散' : '退出'}</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-4">
          <Card>
            <div className="mb-3">
              <SectionTitle kicker={`${players.length} online`}>Players</SectionTitle>
            </div>

            <ul className="space-y-px">
              {players.map((p, idx) => {
                const isGMPlayer = p.uid === room.gmUid;
                return (
                  <li
                    key={p.uid}
                    className={cn(
                      'flex items-center justify-between gap-2 border-l-2 px-2.5 py-2.5',
                      p.uid === uid
                        ? 'border-blood bg-blood/[0.07]'
                        : 'border-transparent bg-black/20',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="numeral w-4 shrink-0 text-[10px] text-bone-faint">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0 truncate text-[13px] text-bone">{p.name}</span>
                      {isGMPlayer && (
                        <span className="numeral shrink-0 border border-brass/50 px-1 text-[9px] tracking-[0.1em] text-brass">
                          GM
                        </span>
                      )}
                      {p.uid === uid && (
                        <span className="numeral shrink-0 text-[9px] tracking-[0.1em] text-[#ff8a9b]">
                          YOU
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        'numeral shrink-0 text-[9px] tracking-[0.12em]',
                        isGMPlayer ? 'text-brass' : p.isReady ? 'text-cyber' : 'text-bone-faint',
                      )}
                    >
                      {isGMPlayer ? 'HOST' : p.isReady ? 'READY' : 'WAIT'}
                    </span>
                  </li>
                );
              })}
            </ul>

            <Rule className="my-4" />

            {isGM ? (
              <>
                <Button className="w-full py-3" disabled={!canStart} onClick={ctrl.startMatch}>
                  <Icon name="play" className="h-3.5 w-3.5" />
                  <span>ゲーム開始 — {settings.roundCount} ROUNDS</span>
                </Button>
                {settings.requireAllReady && !allReady && (
                  <p className="mt-2 text-center text-[11px] text-[#efd894]">
                    全員の準備完了を待っています
                  </p>
                )}
              </>
            ) : (
              <p className="text-center text-[11px] leading-relaxed text-bone-faint">
                GM が開始するのを待っています
                <br />
                <span className="numeral text-[10px] tracking-[0.16em]">AWAITING HOST</span>
              </p>
            )}
          </Card>

          <ChatPanel ctrl={ctrl} />
        </div>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <SectionTitle kicker="Game settings">ルール</SectionTitle>
            <span className="numeral text-[10px] tracking-[0.14em] text-bone-faint">
              {isGM ? 'GM — EDITABLE' : 'READ ONLY'}
            </span>
          </div>
          <SettingsPanel
            settings={settings}
            readOnly={!isGM}
            onChange={(patch) => ctrl.updateSettings(patch)}
          />
        </Card>
      </div>

      {ctrl.error && (
        <div className="animate-rise mt-4 flex items-start gap-2.5 border-l-2 border-blood bg-blood/10 px-3.5 py-2.5 text-[12px] leading-relaxed text-[#ffb3bd]">
          <Icon name="alert" className="mt-0.5 h-3.5 w-3.5" />
          <span>{ctrl.error}</span>
        </div>
      )}

      <ConfirmDialog
        open={leaveConfirm}
        title="ルームを解散しますか？"
        description={
          <>
            GM が退出すると<b className="text-[#ff8a9b]">ルームは削除されます</b>。
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
