import { useEffect, useMemo, useRef, useState } from 'react';
import type { UseRoom } from '../lib/useRoom';
import { normalizeSettings } from '../lib/types';
import { PlayArea } from './PlayArea';
import { Button, Card, formatMs, SectionTitle } from './ui';
import { cn } from '../utils/cn';

/**
 * 解答例一覧。プレイヤーの解答式を紐付けて印表示。
 */
function SolutionsList({
  solutions,
  target,
  playerFormulas,
  myFormula,
}: {
  solutions: string[];
  target: number;
  /** { formula → [playerNames] } */
  playerFormulas?: Map<string, string[]>;
  myFormula?: string;
}) {
  const pageSize = 5;
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [solutions]);
  const shown = solutions.slice(0, (page + 1) * pageSize);
  const remain = solutions.length - shown.length;
  if (solutions.length === 0) {
    return <p className="text-sm text-slate-400">解答例がありません</p>;
  }
  return (
    <div>
      <ul className="space-y-1.5">
        {shown.map((s) => {
          const names = playerFormulas?.get(s) ?? [];
          const isMyAnswer = s === myFormula;
          const othersWhoAnswered = isMyAnswer ? names.filter((n) => n !== '(you)') : names;
          return (
            <li
              key={s}
              className={cn(
                'rounded-xl border px-4 py-2 text-left text-base font-bold sm:text-lg',
                isMyAnswer
                  ? 'border-indigo-400/40 bg-indigo-500/10 text-indigo-100'
                  : names.length > 0
                    ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
                    : 'border-white/8 bg-white/5 text-amber-200',
              )}
            >
              <span>{s}</span>{' '}
              <span className="text-amber-400">= {target}</span>
              {isMyAnswer && (
                <span className="ml-2 text-xs font-bold text-indigo-300">⭐ あなたの解答</span>
              )}
              {othersWhoAnswered.length > 0 && (
                <span className="ml-2 text-xs font-bold text-emerald-300">
                  👥 {othersWhoAnswered.join(', ')}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {remain > 0 && (
        <div className="mt-3 flex justify-center">
          <Button variant="soft" onClick={() => setPage((p) => p + 1)} className="py-2 text-xs">
            さらに解答例を見る（残り {remain} 件）
          </Button>
        </div>
      )}
      <p className="mt-2 text-center text-[11px] text-slate-500">全 {solutions.length} 通り</p>
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
    // ラウンドが変わったらリセット
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

  // 問題切り替え時のチラ見え防止: judging→playingの瞬間、currentRound.endedAt が消え
  // かつカウントダウンが始まるまでの間、全面マスクする
  const prevRoundRef = useRef<number | undefined>(undefined);
  const [transitioning, setTransitioning] = useState(false);
  useEffect(() => {
    if (r?.roundIndex !== undefined && prevRoundRef.current !== undefined && r.roundIndex !== prevRoundRef.current) {
      setTransitioning(true);
    }
    prevRoundRef.current = r?.roundIndex;
  }, [r?.roundIndex]);
  useEffect(() => {
    if (transitioning && isCountdown) {
      setTransitioning(false);
    }
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
  const targetCap = settings.scoringMode === 'first' ? 1 : Math.min(settings.maxRankCount || 3, activeCount);
  const liveCorrectAnswers = Object.entries(answers)
    .filter(([, a]) => a && !a.passed)
    .sort((a, b) => (a[1].adjustedElapsedMs || 0) - (b[1].adjustedElapsedMs || 0));
  const liveCorrectCount = liveCorrectAnswers.length;
  const myLiveIndex = uid ? liveCorrectAnswers.findIndex(([id]) => id === uid) : -1;
  const iAmSolved = myLiveIndex >= 0;
  const myLiveRank = myLiveIndex >= 0 ? myLiveIndex + 1 : null;

  // 解答例とプレイヤーの紐付け（式文字列 → [名前]）
  // あなたの解答には "(you)" というマーカーをつける
  const playerFormulas = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const [pId, res] of Object.entries(results)) {
      const f = res.formula;
      if (!f) continue;
      const list = m.get(f) ?? [];
      const name = pId === uid ? '(you)' : nameOf(pId);
      list.push(name);
      m.set(f, list);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, uid]);

  // あなたの解答式を特定
  const myFormula = uid && results[uid] ? results[uid].formula : undefined;

  const showMask = isCountdown || transitioning;

  return (
    <div className="relative mx-auto w-full max-w-6xl px-4 py-5" data-tick={tick}>
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="grid-overlay absolute inset-0" />
        <div className="drift-slow absolute -right-10 top-10 h-64 w-64 rounded-full bg-fuchsia-600/15 blur-3xl" />
        <div className="drift absolute -left-10 bottom-0 h-64 w-64 rounded-full bg-indigo-600/15 blur-3xl" />
      </div>

      {/* ヘッダー */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip border-indigo-400/40 bg-indigo-500/15 text-indigo-100">
            ROUND {roundNo} / {settings.roundCount}
          </span>
          {settings.showDifficulty && typeof r.solutionCount === 'number' && (
            <span className="chip border-violet-400/40 bg-violet-500/15 text-violet-100">
              解 {r.solutionCount} 通り
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black tracking-[.3em] text-slate-400">
              {settings.unlimitedTime ? 'ELAPSED' : 'TIME LEFT'}
            </span>
            <span
              className={cn(
                'text-3xl font-black leading-none tabular-nums',
                remainMs !== null && remainMs < 10000 ? 'text-rose-300' : 'text-white',
              )}
            >
              {showMask
                ? '—'
                : ((remainMs ?? displayElapsed) / 1000).toFixed(1)}
            </span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-black tracking-[.3em] text-amber-200/70">TARGET</span>
            <span className="grid h-14 w-14 place-items-center rounded-2xl border border-amber-300/40 bg-gradient-to-b from-amber-400/25 to-orange-500/15 text-3xl font-black text-amber-200 shadow-[0_0_30px_-6px_rgba(251,191,36,.5)]">
              {r.target}
            </span>
          </div>
        </div>
      </div>

      {timeFrac !== null && !showMask && (
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/8">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-100',
              timeFrac < 0.25
                ? 'bg-gradient-to-r from-rose-500 to-red-400'
                : 'bg-gradient-to-r from-indigo-400 to-fuchsia-400',
            )}
            style={{ width: `${Math.max(0, timeFrac * 100)}%` }}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <Card className="relative overflow-hidden p-5 sm:p-6">
          <div className="pointer-events-none absolute -left-12 -top-12 h-48 w-48 rounded-full bg-indigo-600/15 blur-3xl" />
          {/* 定員ステータスバー */}
          {!judging && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs">
              <span className="flex items-center gap-2 font-bold text-slate-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                入賞枠: <b className="text-amber-300">{liveCorrectCount} / {targetCap}人</b>
                {liveCorrectCount < targetCap ? `（残り${targetCap - liveCorrectCount}枠 受付中）` : '（定員到達！）'}
              </span>
              <span className="text-slate-400">
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
            disabled={judging || iAmSolved || !!myAnswer?.passed}
            disabledReason={
              judging
                ? 'ラウンド終了！結果を表示中です'
                : iAmSolved
                  ? `🎉 正解完了（${myLiveRank}位抜け！式: ${myAnswer?.formula}）他のプレイヤーの解答を待っています…`
                  : myAnswer?.passed
                    ? '⏭ パスしました。他の未正解者が全員パスするか、定員に達すると次の問題へ進みます'
                    : undefined
            }
            passed={!!myAnswer?.passed}
            isCountdown={showMask}
            onSolved={(f) => ctrl.submitAnswer(f)}
            onPass={() => ctrl.passRound()}
          />
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <SectionTitle icon="👥">プレイヤー状況</SectionTitle>
            <button
              onClick={ctrl.leaveRoom}
              className="rounded-lg px-2 py-1 text-[11px] font-bold text-slate-400 transition hover:bg-white/8 hover:text-rose-300"
              title="対戦を離れます"
            >
              途中退出
            </button>
          </div>
          <ul className="space-y-2">
            {[...players]
              .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
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
                      'flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm transition',
                      p.uid === uid && 'border-indigo-400/50 bg-indigo-500/12',
                      hasSolved && 'border-emerald-400/40 bg-emerald-500/10',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-1.5 truncate font-bold text-white">
                      {p.uid === room.gmUid && <span className="text-xs">👑</span>}
                      <span className="truncate">{p.name}</span>
                      {p.uid === uid && <span className="text-[10px] text-indigo-300 font-normal">(you)</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span
                        className={cn(
                          'text-[11px] font-bold',
                          hasSolved
                            ? 'text-emerald-300'
                            : isPassed
                              ? 'text-slate-500'
                              : 'text-amber-300',
                        )}
                      >
                        {hasSolved
                          ? `${solveRank === 1 ? '🥇' : solveRank === 2 ? '🥈' : solveRank === 3 ? '🥉' : `${solveRank}位`}`
                          : isPassed
                            ? '⏭ パス'
                            : '⌛ 思考中'}
                      </span>
                      <span className="min-w-7 rounded-lg bg-white/10 px-2 py-0.5 text-center text-xs font-black tabular-nums text-amber-200">
                        {p.score ?? 0}
                      </span>
                    </span>
                  </li>
                );
              })}
          </ul>

          {/* あなたのリアルタイム状態通知 */}
          {!judging && (
            <div className="mt-3">
              {iAmSolved ? (
                <div className="animate-float-up rounded-xl border border-emerald-400/40 bg-emerald-500/15 p-3 text-center text-xs font-bold text-emerald-100">
                  <div className="text-sm font-black text-emerald-300">
                    {myLiveRank === 1 ? '🥇 1位で正解！' : `${myLiveRank}位で正解！`}
                  </div>
                  <div className="mt-1 text-[11px] text-emerald-200/80">
                    他のプレイヤーが解き終わるか、未正解者が全員パスするまでお待ちください
                  </div>
                </div>
              ) : myAnswer?.passed ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center text-xs text-slate-300">
                  <div className="font-bold text-slate-200">⏭ パス中</div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    まだ解いている未正解者が全員パスすれば終了します。<br />
                    ひらめいたらパス後も解き直してOK！
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-indigo-400/30 bg-indigo-500/10 p-3 text-center text-xs text-indigo-200">
                  <div className="font-bold">
                    残り <b className="text-amber-300">{Math.max(0, targetCap - liveCorrectCount)}枠</b>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    どうしても解けない時は「パス」ボタンを押せます
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* カウントダウン + チラ見え防止 */}
      {showMask && (
        <div className="animate-fade-in fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
          <span className="mb-2 text-sm font-black tracking-[.4em] text-indigo-200">GET READY</span>
          {count > 0 && (
            <span
              key={count}
              className="animate-count bg-gradient-to-b from-white to-indigo-300 bg-clip-text text-[10rem] font-black leading-none text-transparent drop-shadow-[0_0_40px_rgba(129,140,248,.6)]"
            >
              {count}
            </span>
          )}
          <span className="mt-4 text-xs font-bold tracking-widest text-slate-400">
            ROUND {roundNo}
          </span>
        </div>
      )}

      {room?.status === 'judging' && !r?.endedAt && (
        <div className="animate-fade-in fixed inset-x-0 bottom-0 z-20 flex justify-center p-4">
          <div className="flex items-center gap-3 rounded-2xl border border-indigo-400/30 bg-slate-950/90 px-5 py-3 text-sm font-bold text-indigo-100 backdrop-blur">
            <span className="h-4 w-4 animate-spin-slow rounded-full border-2 border-indigo-400 border-t-transparent" />
            結果を確定しています…
          </div>
        </div>
      )}

      {/* ラウンド結果 */}
      {judging && (
        <div className="animate-fade-in fixed inset-0 z-30 flex items-end justify-center bg-black/75 p-4 backdrop-blur-sm sm:items-center">
          <Card accent className="animate-bounce-in max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
            {hasAnswers ? (
              <div className="text-center">
                <div className="text-[11px] font-black tracking-[.4em] text-indigo-300">RESULT</div>
                {r.winnerUid && (
                  <>
                    <div className="mt-2 animate-pop text-3xl font-black text-white sm:text-4xl">
                      🏆 {nameOf(r.winnerUid)}
                    </div>
                    {closeCall && (
                      <div className="mt-2 inline-block rounded-full bg-rose-500/20 px-4 py-1.5 text-sm font-black text-rose-200">
                        ⚡ 僅差！
                      </div>
                    )}
                  </>
                )}
                <div className="mt-4 text-left">
                  <div className="mb-2 text-[11px] font-black tracking-widest text-slate-400">
                    みんなの正解
                  </div>
                  <ul className="space-y-1.5">
                    {ranked.map(([id, res]) => (
                      <li
                        key={id}
                        className={cn(
                          'rounded-xl border px-4 py-2.5',
                          res.rank === 1
                            ? 'border-amber-300/40 bg-amber-400/10'
                            : 'border-white/8 bg-white/5',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-300">
                          <span>
                            {res.rank}位 {nameOf(id)}
                            {id === uid ? ' (you)' : ''}
                            {res.gained > 0 ? ` · +${res.gained}点` : ''}
                          </span>
                          <span className="tabular-nums">{formatMs(res.adjustedElapsedMs)}</span>
                        </div>
                        <div className="mt-1 text-base font-black text-amber-100">
                          {res.formula} <span className="text-amber-400">= {r.target}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-[11px] font-black tracking-[.4em] text-slate-400">
                  ラウンド不成立（{r.outcome === 'timeup' ? '時間切れ' : '全員パス'}）
                </div>
                <div className="mt-2 text-xl font-black text-white">誰も正解できませんでした</div>
              </div>
            )}

            <div className="mt-5">
              <div className="mb-2 text-center text-[11px] font-black tracking-widest text-indigo-200">
                解答例
              </div>
              <SolutionsList
                solutions={allSols}
                target={r.target}
                playerFormulas={playerFormulas}
                myFormula={myFormula}
              />
            </div>

            <div className="mt-6 flex justify-center">
              {isGM ? (
                <Button onClick={ctrl.nextRound}>次の問題へ ▶</Button>
              ) : (
                <span className="text-xs text-slate-400">
                  GMが次の問題を出題するのを待っています…
                </span>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
