import { useEffect, useMemo, useRef, useState } from 'react';
import type { UseRoom } from '../lib/useRoom';
import { normalizeSettings } from '../lib/types';
import type { Solution } from '../lib/solver';
import { PlayArea } from './PlayArea';
import { ChatComposer } from './ChatDock';
import { Button, Card, RankBadge, SectionTitle, formatMs } from './ui';
import { IconAlert, IconArrowRight, IconCheck, IconClose, IconCrown, IconTrophy, IconUsers } from './icons';
import { playSe } from '../lib/audio';
import { cn } from '../utils/cn';

/**
 * 解答例一覧。プレイヤーの解答式を紐付けて印表示。
 * 紐付けは表示文字列ではなく等価判定キー（Solution.key）で行う。
 */
function SolutionsList({
  solutions,
  target,
  playerNamesByKey,
  myKey,
}: {
  solutions: Solution[];
  target: number;
  /** { 等価判定key → [playerNames] } */
  playerNamesByKey?: Map<string, string[]>;
  myKey?: string;
}) {
  const pageSize = 5;
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [solutions]);
  const shown = solutions.slice(0, (page + 1) * pageSize);
  const remain = solutions.length - shown.length;
  if (solutions.length === 0) {
    return <p className="jp text-[12px] text-slate-400">解答例がありません</p>;
  }
  return (
    <div>
      <ul className="space-y-1.5">
        {shown.map((s) => {
          const names = playerNamesByKey?.get(s.key) ?? [];
          const isMyAnswer = !!myKey && s.key === myKey;
          const othersWhoAnswered = isMyAnswer ? names.filter((n) => n !== '(you)') : names;
          return (
            <li
              key={s.key}
              className={cn(
                'border-l px-3 py-1.5 text-left',
                isMyAnswer
                  ? 'border-cyan-300/80 bg-cyan-400/10'
                  : names.length > 0
                    ? 'border-emerald-400/70 bg-emerald-500/8'
                    : 'border-white/12 bg-white/[0.03]',
              )}
            >
              <span className="num text-[14px] font-bold text-amber-100 sm:text-[15px]">
                {s.formula}
              </span>{' '}
              <span className="text-fuchsia-300">= {target}</span>
              {isMyAnswer && (
                <span className="ml-2 text-[10px] font-bold tracking-wider text-cyan-300">
                  YOUR ANSWER
                </span>
              )}
              {othersWhoAnswered.length > 0 && (
                <span className="jp ml-2 text-[10px] font-bold text-emerald-300">
                  {othersWhoAnswered.join(' / ')}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {remain > 0 && (
        <div className="mt-3 flex justify-center">
          <Button variant="soft" onClick={() => setPage((p) => p + 1)} className="py-2 text-[10px]">
            さらに解答例を見る（残り {remain} 件）
          </Button>
        </div>
      )}
      <p className="num mt-2 text-center text-[10px] tracking-[.2em] text-slate-500">
        TOTAL {solutions.length}
      </p>
    </div>
  );
}

const COUNTDOWN_MS = 3000;

export function GameScreen({ ctrl }: { ctrl: UseRoom }) {
  const { room, players, uid, isGM } = ctrl;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 100);
    return () => clearInterval(id);
  }, []);

  const settings = useMemo(() => normalizeSettings(room?.settings), [room?.settings]);
  const r = room?.currentRound;
  const answers = (room?.answers?.[String(r?.roundIndex ?? -1)] ?? {}) as Record<string, any>;
  const myAnswer = uid ? answers[uid] : undefined;
  const judging = room?.status === 'judging' && !!r?.endedAt;

  const matchStartIndex = (r as any)?.matchStartIndex ?? 0;
  const roundNo = r ? r.roundIndex - matchStartIndex + 1 : 1;

  const startedAtValid = typeof r?.startedAt === 'number' && r.startedAt > 1_000_000_000_000;
  const elapsedMs = r && startedAtValid ? Math.max(0, ctrl.serverNow() - r.startedAt) : 0;
  const isCountdown = room?.status === 'playing' && (!startedAtValid || elapsedMs < COUNTDOWN_MS);
  const count = isCountdown
    ? startedAtValid
      ? Math.max(1, Math.ceil((COUNTDOWN_MS - elapsedMs) / 1000))
      : 3
    : 0;

  // 正解した瞬間のタイマーをフリーズする
  const frozenElapsedRef = useRef<number | null>(null);
  useEffect(() => {
    frozenElapsedRef.current = null;
  }, [r?.roundIndex]);
  useEffect(() => {
    if (myAnswer && !myAnswer.passed && frozenElapsedRef.current === null) {
      frozenElapsedRef.current = Math.max(0, elapsedMs - COUNTDOWN_MS);
    }
  }, [myAnswer, elapsedMs]);
  const displayElapsed = frozenElapsedRef.current ?? Math.max(0, elapsedMs - COUNTDOWN_MS);

  const remainMs = settings.unlimitedTime
    ? null
    : Math.max(0, settings.timeLimitSec * 1000 - displayElapsed);
  const timeFrac = remainMs === null ? null : remainMs / (settings.timeLimitSec * 1000);

  // カウントダウンの SE（3・2・1 → GO）
  useEffect(() => {
    if (!isCountdown) return;
    if (count > 0) playSe('tick');
  }, [isCountdown, count]);
  const wasCountdownRef = useRef(false);
  useEffect(() => {
    if (wasCountdownRef.current && !isCountdown) playSe('go');
    wasCountdownRef.current = isCountdown;
  }, [isCountdown]);

  // ラウンド確定時のお知らせ音
  const prevJudgingRef = useRef<string>('');
  useEffect(() => {
    const key = judging ? `j-${r?.roundIndex}` : '';
    if (key && key !== prevJudgingRef.current) playSe('roundEnd');
    prevJudgingRef.current = key;
  }, [judging, r?.roundIndex]);

  // 問題切り替え時のチラ見え防止
  const prevRoundRef = useRef<number | undefined>(undefined);
  const [transitioning, setTransitioning] = useState(false);
  useEffect(() => {
    if (
      r?.roundIndex !== undefined &&
      prevRoundRef.current !== undefined &&
      r.roundIndex !== prevRoundRef.current
    ) {
      setTransitioning(true);
    }
    prevRoundRef.current = r?.roundIndex;
  }, [r?.roundIndex]);
  useEffect(() => {
    if (transitioning && isCountdown) setTransitioning(false);
  }, [transitioning, isCountdown]);

  if (!room || !r) return null;

  const results = r.results ?? {};
  const ranked = Object.entries(results).sort((a, b) => a[1].rank - b[1].rank);
  const hasAnswers = ranked.length > 0;
  const closeCall =
    ranked.length >= 2 &&
    Math.abs(ranked[1][1].adjustedElapsedMs - ranked[0][1].adjustedElapsedMs) <= 300;
  const nameOf = (id: string) => players.find((p) => p.uid === id)?.name ?? '退出したプレイヤー';
  const allSols = r.solutions ?? [];

  // リアルタイムの正解者数と枠
  const activeCount = players.length;
  const targetCap =
    settings.scoringMode === 'first' ? 1 : Math.min(settings.maxRankCount || 3, activeCount);
  const liveCorrectAnswers = Object.entries(answers)
    .filter(([, a]) => a && !a.passed)
    .sort((a, b) => (a[1].adjustedElapsedMs || 0) - (b[1].adjustedElapsedMs || 0));
  const liveCorrectCount = liveCorrectAnswers.length;
  const myLiveIndex = uid ? liveCorrectAnswers.findIndex(([id]) => id === uid) : -1;
  const iAmSolved = myLiveIndex >= 0;
  const myLiveRank = myLiveIndex >= 0 ? myLiveIndex + 1 : null;

  const playerNamesByKey = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const [pId, res] of Object.entries(results)) {
      const k = res.key;
      if (!k) continue;
      const list = m.get(k) ?? [];
      const name = pId === uid ? '(you)' : nameOf(pId);
      list.push(name);
      m.set(k, list);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, uid]);

  const myKey = uid && results[uid] ? results[uid].key : undefined;
  const showMask = isCountdown || transitioning;

  return (
    <div className="relative mx-auto w-full max-w-6xl px-4 py-4 pb-20" data-tick={tick}>
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="grid-overlay absolute inset-0" />
        <div className="absolute -right-10 top-10 h-64 w-64 rounded-full ambient-magenta" />
        <div className="absolute -left-10 bottom-0 h-64 w-64 rounded-full ambient-cyan" />
      </div>

      {/* ヘッダー */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip text-cyan-100">
            ROUND
            <b className="num ml-1 text-[12px] text-white">
              {String(roundNo).padStart(2, '0')}
            </b>
            <span className="text-cyan-200/40">/</span>
            <b className="num text-[12px] text-cyan-200/80">
              {String(settings.roundCount).padStart(2, '0')}
            </b>
          </span>
          {settings.showDifficulty && typeof r.solutionCount === 'number' && (
            <span className="chip border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-200">
              SOLUTIONS {r.solutionCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="label text-[9px] text-slate-500">
              {settings.unlimitedTime ? 'ELAPSED' : 'TIME LEFT'}
            </span>
            <span
              className={cn(
                'num text-[28px] leading-none font-black',
                remainMs !== null && remainMs < 10000 ? 'text-rose-300' : 'text-white',
              )}
              style={{ textShadow: '0 0 20px rgba(34,224,255,.3)' }}
            >
              {showMask ? '—' : ((remainMs ?? displayElapsed) / 1000).toFixed(1)}
            </span>
          </div>
          <div className="flex flex-col items-center border border-solar/40 bg-solar/8 px-3 py-1">
            <span className="label text-[8px] text-amber-200/70">TARGET</span>
            <span className="num text-[24px] leading-none font-black text-amber-300">{r.target}</span>
          </div>
        </div>
      </div>

      {timeFrac !== null && !showMask && (
        <div className="mb-3 h-[3px] overflow-hidden bg-white/8">
          <div
            className={cn(
              'h-full transition-all duration-100',
              timeFrac < 0.25
                ? 'bg-gradient-to-r from-rose-500 to-orange-400 shadow-[0_0_14px_rgba(255,80,120,.9)]'
                : 'bg-gradient-to-r from-cyan-400 to-fuchsia-400 shadow-[0_0_14px_rgba(34,224,255,.8)]',
            )}
            style={{ width: `${Math.max(0, timeFrac * 100)}%` }}
          />
        </div>
      )}

      <div className="grid gap-3.5 lg:grid-cols-[1fr_268px]">
        <Card className="relative overflow-hidden p-4 sm:p-5">
          {/* 定員ステータスバー */}
          {!judging && !settings.hideLiveAnswers && (
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2 border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px]">
              <span className="jp flex items-center gap-2 font-bold text-slate-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
                入賞枠
                <b className="num text-amber-300">
                  {liveCorrectCount} / {targetCap}
                </b>
                <span className="text-slate-500">
                  {liveCorrectCount < targetCap
                    ? `（残り${targetCap - liveCorrectCount}枠 受付中）`
                    : '（定員到達）'}
                </span>
              </span>
              <span className="jp hidden text-[10px] text-slate-500 sm:inline">
                未正解の人が全員パスしても終了します
              </span>
            </div>
          )}

          <PlayArea
            numbers={r.numbers}
            target={r.target}
            allowedOperators={settings.allowedOperators}
            integerOnly={settings.integerOnly}
            penaltyMode={settings.penaltyMode}
            disabled={judging || iAmSolved}
            disabledReason={
              judging
                ? 'ラウンド終了。結果を表示しています。'
                : iAmSolved
                  ? settings.hideLiveAnswers
                    ? '正解済み。結果発表をお待ちください…'
                    : `正解済み（${myLiveRank}位で抜け／式: ${myAnswer?.formula}）他のプレイヤーの解答を待っています…`
                  : undefined
            }
            passed={!!myAnswer?.passed}
            roundKey={r.roundIndex}
            isCountdown={showMask}
            onSolved={(f, k) => ctrl.submitAnswer(f, k)}
            onPass={() => ctrl.passRound()}
            onCancelPass={room.status === 'playing' ? () => ctrl.cancelPass() : undefined}
          />

          {/* 対戦中でもすぐ送れる1行チャット（ログは左下のCOMMSボタンから） */}
          <div className="mt-3 border-t border-white/10 pt-2.5">
            <ChatComposer ctrl={ctrl} compact />
          </div>
        </Card>

        <div className="flex flex-col gap-3.5">
          <Card>
            <div className="mb-2.5 flex items-center justify-between">
              <SectionTitle icon={<IconUsers size={13} />}>PLAYERS</SectionTitle>
              <button
                onClick={ctrl.leaveRoom}
                className="text-[10px] font-bold tracking-wider text-slate-500 transition hover:text-rose-300"
                title="対戦を離れます"
              >
                途中退出
              </button>
            </div>
            <ul className="space-y-1.5">
              {[...players]
                .sort((a, b) => settings.hideLiveAnswers && !judging ? 0 : (b.score ?? 0) - (a.score ?? 0))
                .map((p) => {
                  const a = answers[p.uid];
                  const solveRankIndex = liveCorrectAnswers.findIndex(([id]) => id === p.uid);
                  const hasSolved = solveRankIndex >= 0;
                  const solveRank = hasSolved ? solveRankIndex + 1 : null;
                  const isPassed = a?.passed;

                  return (
                    <li
                      key={p.uid}
                      className={cn(
                        'flex items-center justify-between gap-2 border-l-2 bg-black/30 px-2.5 py-1.5 text-[12px] transition',
                        p.uid === uid ? 'border-cyan-300/90 bg-cyan-400/8' : 'border-white/12',
                        hasSolved && (!settings.hideLiveAnswers || p.uid === uid || judging) && 'border-emerald-400/90 bg-emerald-500/8',
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-1.5 truncate font-bold text-white">
                        {p.uid === room.gmUid && <IconCrown size={11} className="shrink-0 text-amber-300" />}
                        <span className="truncate">{p.name}</span>
                        {p.uid === uid && (
                          <span className="shrink-0 text-[8px] tracking-wider text-cyan-300/80">YOU</span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {settings.hideLiveAnswers && !judging && p.uid !== uid ? (
                          <span className="text-[9px] font-bold tracking-wider text-slate-500">非公開</span>
                        ) : hasSolved ? (
                          <span className="flex items-center gap-1 text-[9px] font-bold tracking-wider text-emerald-300">
                            <IconCheck size={10} />
                            {settings.hideLiveAnswers && !judging ? '正解' : `${solveRank}位`}
                          </span>
                        ) : isPassed ? (
                          <span className="text-[9px] font-bold tracking-wider text-slate-500">PASS</span>
                        ) : (
                          <span className="animate-pulse text-[9px] font-bold tracking-wider text-amber-300/90">
                            THINKING
                          </span>
                        )}
                        {(!settings.hideLiveAnswers || judging) && (
                          <span className="num min-w-6 bg-white/10 px-1.5 py-0.5 text-center text-[11px] font-black text-amber-200">
                            {p.score ?? 0}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
            </ul>

            {/* あなたのリアルタイム状態通知 */}
            {!judging && (
              <div className="mt-2.5">
                {iAmSolved ? (
                  <div className="animate-float-up border border-emerald-400/40 bg-emerald-500/12 p-2.5 text-center">
                    <div className="jp flex items-center justify-center gap-2 text-[13px] font-black text-emerald-300">
                      <IconCheck size={14} />
                      {settings.hideLiveAnswers ? '正解！順位は結果発表で公開' : myLiveRank === 1 ? '1位で正解！' : `${myLiveRank}位で正解！`}
                    </div>
                    <div className="jp mt-1 text-[10px] leading-relaxed text-emerald-200/70">
                      結果発表までお待ちください
                    </div>
                  </div>
                ) : myAnswer?.passed ? (
                  <div className="border border-white/10 bg-white/5 p-2.5 text-center">
                    <div className="jp text-[12px] font-bold text-slate-200">パス中</div>
                    <div className="jp mt-1 text-[10px] leading-relaxed text-slate-400">
                      未正解者が全員パスすると終了します。ひらめいたら解き直してOK。
                    </div>
                  </div>
                ) : (
                  <div className="border border-cyan-400/30 bg-cyan-500/8 p-2.5 text-center">
                    {!settings.hideLiveAnswers && <div className="jp text-[11px] font-bold text-cyan-100">
                      残り{' '}
                      <b className="num text-amber-300">{Math.max(0, targetCap - liveCorrectCount)}</b> 枠
                    </div>}
                    <div className="jp mt-0.5 text-[10px] text-slate-400">
                      どうしても解けない時は「パス」できます
                    </div>
                  </div>
                )}
              </div>
            )}
            <p className="jp mt-2.5 border-t border-white/8 pt-2 text-[9px] leading-relaxed text-slate-500">
              コメントは左下の COMMS ボタンからログで読み返せます
            </p>
          </Card>

        </div>
      </div>

      {/* エラートースト */}
      {ctrl.error && (
        <div className="animate-float-up fixed inset-x-0 top-3 z-[85] mx-auto flex w-[94%] max-w-lg items-start gap-2 border border-rose-400/50 bg-rose-950/95 px-4 py-3 text-left shadow-2xl">
          <IconAlert size={14} className="mt-0.5 shrink-0 text-rose-300" />
          <span className="jp min-w-0 flex-1 text-[11px] font-bold leading-relaxed text-rose-100">
            {ctrl.error}
          </span>
          <button
            onClick={() => ctrl.setError(null)}
            className="shrink-0 text-rose-300 transition hover:text-white"
            aria-label="閉じる"
          >
            <IconClose size={14} />
          </button>
        </div>
      )}

      {/* カウントダウン + チラ見え防止 */}
      {showMask && (
        <div className="animate-fade-in fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md">
          <div className="pointer-events-none absolute inset-0 grid-overlay opacity-40" />
          <span className="label animate-flicker mb-2 text-[11px] text-cyan-200">GET READY</span>
          {count > 0 && (
            <span
              key={count}
              className="num animate-count bg-gradient-to-b from-white via-cyan-200 to-fuchsia-400 bg-clip-text text-[9rem] font-black leading-none text-transparent sm:text-[11rem]"
              style={{ filter: 'drop-shadow(0 0 40px rgba(34,224,255,.7))' }}
            >
              {count}
            </span>
          )}
          <span className="num mt-4 text-[11px] tracking-[.4em] text-slate-400">ROUND {roundNo}</span>
        </div>
      )}

      {room?.status === 'judging' && !r?.endedAt && (
        <div className="animate-fade-in fixed inset-x-0 bottom-0 z-20 flex justify-center p-4">
          <div className="flex items-center gap-3 border border-cyan-400/30 bg-slate-950/90 px-5 py-3 text-[11px] font-bold tracking-wider text-cyan-100 backdrop-blur">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
            CALCULATING…
          </div>
        </div>
      )}

      {/* ラウンド結果 */}
      {judging && (
        <div className="animate-fade-in fixed inset-0 z-30 flex items-end justify-center bg-black/80 p-3 backdrop-blur-sm sm:items-center">
          <Card
            accent
            className="animate-bounce-in max-h-[92vh] w-full max-w-lg overflow-y-auto p-5 sm:p-6"
          >
            {hasAnswers ? (
              <div>
                <div className="text-center">
                  <div className="label text-cyan-300/80">ROUND RESULT</div>
                  {r.winnerUid && (
                    <>
                      <div className="mt-2.5 flex items-center justify-center gap-3">
                        <RankBadge rank={1} size="lg" />
                        <div className="text-left">
                          <div className="num text-[28px] leading-none font-black text-white sm:text-[32px]">
                            {nameOf(r.winnerUid)}
                          </div>
                          <div className="label mt-1 text-[9px] text-amber-300/90">FASTEST SOLVER</div>
                        </div>
                      </div>
                      {closeCall && (
                        <div className="mt-2 inline-block border border-fuchsia-400/50 bg-fuchsia-500/15 px-3 py-1 text-[10px] font-black tracking-widest text-fuchsia-200">
                          CLOSE CALL // 僅差
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="mt-4">
                  <div className="label mb-2 text-slate-400">SCOREBOARD</div>
                  <ul className="space-y-1.5">
                    {ranked.map(([id, res]) => (
                      <li
                        key={id}
                        className={cn(
                          'flex items-start gap-2.5 border-l-2 px-2.5 py-2',
                          res.rank === 1
                            ? 'border-amber-300/80 bg-amber-400/8'
                            : 'border-white/12 bg-white/[0.03]',
                        )}
                      >
                        <RankBadge rank={res.rank} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="jp truncate text-[12px] font-bold text-slate-200">
                              {nameOf(id)}
                              {id === uid && (
                                <span className="ml-1 text-[9px] tracking-wider text-cyan-300">YOU</span>
                              )}
                            </span>
                            <span className="num shrink-0 text-[11px] tabular-nums text-cyan-200/80">
                              {formatMs(res.adjustedElapsedMs)}
                              {res.gained > 0 && (
                                <span className="ml-2 text-emerald-300">+{res.gained}</span>
                              )}
                            </span>
                          </div>
                          <div className="num mt-0.5 truncate text-[13px] font-bold text-amber-100">
                            {res.formula} <span className="text-fuchsia-300">= {r.target}</span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="label text-slate-400">
                  ROUND VOID // {r.outcome === 'timeup' ? '時間切れ' : '全員パス'}
                </div>
                <div className="jp mt-2 text-lg font-black text-white">誰も正解できませんでした</div>
              </div>
            )}

            <div className="mt-5">
              <div className="label mb-2 text-center text-cyan-200/80">SOLUTIONS</div>
              <SolutionsList
                solutions={allSols}
                target={r.target}
                playerNamesByKey={playerNamesByKey}
                myKey={myKey}
              />
            </div>

            <div className="mt-6 flex justify-center">
              {isGM ? (
                <Button onClick={ctrl.nextRound} className="gap-2">
                  {roundNo >= settings.roundCount ? (
                    <>
                      <IconTrophy size={14} /> 最終結果へ
                    </>
                  ) : (
                    <>
                      次の問題へ <IconArrowRight size={14} />
                    </>
                  )}
                </Button>
              ) : (
                <span className="jp text-[11px] text-slate-400">GMが次の問題を出題するのを待っています…</span>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
