import { useEffect, useRef, useState } from 'react';
import type { UseRoom } from '../lib/useRoom';
import { normalizeSettings } from '../lib/types';
import { Button, Card, ConfirmDialog, RankBadge } from './ui';
import { IconCrown, IconTrophy } from './icons';
import { IndividualStandings } from './IndividualStandings';
import {
  computeIndividualStandings,
  computeTeamStandings,
  filterMatchParticipants,
  formatPrimaryValue,
  getWinningTeams,
  WIN_CONDITION_LABEL,
  WIN_CONDITION_UNIT,
} from '../lib/teams';
import { playSe } from '../lib/audio';
import { cn } from '../utils/cn';

export function FinalResult({ ctrl }: { ctrl: UseRoom }) {
  const { participants, isGM, uid, room } = ctrl;
  const [leaveConfirm, setLeaveConfirm] = useState(false);

  // チーム戦の最終判定（選択した勝利条件の値だけで決める。同値なら引き分け）
  const settings = normalizeSettings(room?.settings);
  const isTeam = settings.battleMode === 'team';
  const matchStartIndex = (room?.currentRound as any)?.matchStartIndex ?? 0;
  const mergedHistory: Record<string, any> = { ...(room?.history ?? {}) };
  if (room?.currentRound?.results) {
    mergedHistory[String(room.currentRound.roundIndex)] = room.currentRound;
  }
  // 抜けた人も、結果が残っていれば最終成績に含める（在室者だけで判定しない）
  const standingPlayers = filterMatchParticipants(participants, mergedHistory, matchStartIndex);
  const champ = [...standingPlayers].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  const { standings: teamStandings } = isTeam
    ? computeTeamStandings({
        players: standingPlayers,
        teamCount: settings.teamCount,
        winCondition: settings.teamWinCondition,
        history: mergedHistory,
        matchStartIndex,
      })
    : { standings: [] };
  const winningTeams = isTeam ? getWinningTeams(teamStandings) : [];
  const individualRows = computeIndividualStandings({
    players: standingPlayers,
    history: mergedHistory,
    matchStartIndex,
  });
  const isDraw = winningTeams.length > 1;
  const myTeamId = uid ? participants.find((p) => p.uid === uid)?.teamId : null;
  const playedRef = useRef(false);

  useEffect(() => {
    if (playedRef.current) return;
    playedRef.current = true;
    playSe('finish');
  }, []);

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-8 pb-24">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="grid-overlay absolute inset-0" />
        <div className="absolute -right-10 top-16 h-64 w-64 rounded-full ambient-amber" />
        <div className="absolute -left-10 bottom-10 h-64 w-64 rounded-full ambient-cyan" />
      </div>

      <div className="mt-auto" />

      <div className="mb-5 text-center">
        <div className="label mb-2 text-amber-200/80">FINAL RESULT</div>
        <h2 className="font-display text-[26px] font-black tracking-[.2em] text-white sm:text-[32px]">
          <span className="grad-solar">MATCH COMPLETE</span>
        </h2>
      </div>

      {/* チーム戦の結果（勝利条件の値で判定。同点は引き分け） */}
      {isTeam && teamStandings.length > 0 && (
        <div className="mb-4">
          <Card accent className="overflow-hidden p-5">
            <div className="scan-line" />
            <div className="relative text-center">
              <div className="label text-cyan-200/80">
                TEAM RESULT // 勝利条件: {WIN_CONDITION_LABEL[settings.teamWinCondition]}
              </div>
              {isDraw ? (
                <div className="jp mt-2 text-[24px] font-black text-white sm:text-[28px]">
                  引き分け
                  <span className="ml-2 text-[14px] text-slate-300">
                    （{winningTeams.map((t) => t.def.label).join('・')}）
                  </span>
                </div>
              ) : winningTeams[0] ? (
                <div
                  className="jp mt-2 text-[26px] font-black sm:text-[32px]"
                  style={{ color: winningTeams[0].def.color, textShadow: `0 0 24px ${winningTeams[0].def.color}88` }}
                >
                  {winningTeams[0].def.label} の勝利
                </div>
              ) : null}
              <p className="jp mt-1 text-[10px] text-slate-400">
                {myTeamId != null
                  ? winningTeams.some((t) => t.teamId === myTeamId)
                    ? isDraw
                      ? 'あなたのチームは引き分けです'
                      : 'あなたのチームが勝ちました'
                    : 'あなたのチームは敗れました'
                  : '個人ランキングは下にあります'}
              </p>
            </div>
          </Card>

          <div className="mt-2 space-y-2">
            {teamStandings.map((t, i) => {
              const isWinner = winningTeams.some((w) => w.teamId === t.teamId);
              return (
                <div
                  key={t.teamId}
                  className={cn('border px-3 py-2.5', myTeamId === t.teamId && 'ring-1 ring-white/40')}
                  style={{
                    borderColor: `${t.def.color}${isWinner ? 'aa' : '44'}`,
                    background: `${t.def.color}${isWinner ? '1c' : '0d'}`,
                    clipPath:
                      'polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)',
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="num text-[13px] font-black text-slate-400">{i + 1}</span>
                    <span className="jp text-[15px] font-black" style={{ color: t.def.color }}>
                      {t.def.label}
                    </span>
                    {isWinner && !isDraw && <IconTrophy size={13} className="text-amber-300" />}
                    <span className="num ml-auto text-[22px] font-black text-white tabular-nums">
                      {formatPrimaryValue(t.primaryValue, settings.teamWinCondition)}
                      <span className="ml-0.5 text-[11px] text-slate-400">
                        {WIN_CONDITION_UNIT[settings.teamWinCondition]}
                      </span>
                    </span>
                  </div>
                  <div className="jp mt-1 flex flex-wrap gap-x-3 text-[10px] text-slate-400">
                    <span>合計 {t.totalScore}点</span>
                    <span>平均 {formatPrimaryValue(t.averageScore, 'averageScore')}点</span>
                    <span>1位 {t.firstPlaceCount}回</span>
                    <span>正解 {t.correctCount}回</span>
                    <span>{t.members.length}人</span>
                  </div>
                  {t.members.length > 0 && (
                    <div className="jp mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] text-slate-200">
                      {t.members.map((m) => (
                        <span key={m.uid} className={cn(m.uid === uid && 'font-black text-cyan-200')}>
                          {m.name}
                          {m.left && <span className="ml-1 text-slate-500">（退出）</span>}{' '}
                          <span className="num text-slate-400">
                            {m.score}点・1位{m.firstPlaceCount}回・正解{m.correctCount}回
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="label jp mt-4 mb-2 text-center text-slate-400">個人ランキング</div>
        </div>
      )}

      {/* 優勝パネル */}
      {champ && (
        <Card accent className="mb-4 overflow-hidden p-5">
          <div className="scan-line" />
          <div className="relative flex items-center gap-4">
            <RankBadge rank={1} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="label flex items-center gap-1.5 text-amber-300/90">
                <IconCrown size={11} /> CHAMPION
              </div>
              <div className="num text-[26px] leading-tight font-black break-words text-white sm:text-[30px]" style={{ overflowWrap: 'anywhere' }}>
                {champ.name}
              </div>
              <div className="jp text-[10px] text-slate-400">
                {champ.uid === uid ? 'あなたが1位です' : 'おめでとう！'}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="label text-[8px] text-slate-500">SCORE</div>
              <div className="num text-[34px] leading-none font-black text-amber-300 tabular-nums">
                {champ.score ?? 0}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* 個人成績はチーム戦でも必ず表示する（チーム順位 → 個人順位の順） */}
      {isTeam && (
        <div className="label jp mb-2 text-center text-slate-400">
          個人成績（順位・得点・1位数・正解数）
        </div>
      )}
      <IndividualStandings rows={individualRows} myUid={uid} reveal />

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {isGM && (
          <Button onClick={ctrl.backToLobby} className="gap-1.5">
            <IconTrophy size={13} /> ロビーに戻る（再戦）
          </Button>
        )}
        <Button variant="ghost" onClick={() => (isGM ? setLeaveConfirm(true) : ctrl.leaveRoom())}>
          退出する
        </Button>
      </div>
      {!isGM && (
        <p className="jp mt-2 text-center text-[10px] text-slate-400">
          GMがロビーに戻すと再戦できます。
        </p>
      )}

      <div className="mb-auto" />

      <ConfirmDialog
        open={leaveConfirm}
        title="ルームを解散しますか？"
        description={
          <>
            GMが退出すると<b className="text-rose-300">ルームは削除されます</b>。
            チャット・スコア・履歴も残りません。
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
