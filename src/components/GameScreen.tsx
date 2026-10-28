import { useEffect, useMemo, useRef, useState } from 'react';
import type { UseRoom } from '../lib/useRoom';
import { normalizeSettings } from '../lib/types';
import type { Solution } from '../lib/solver';
import { PlayArea } from './PlayArea';
import { ChatPanel } from './ChatPanel';
import { Button, Card, Icon, Rule, formatMs } from './ui';
import { cn } from '../utils/cn';

const ORDINAL = ['1', '2', '3'];

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
    return <p className="text-[12px] text-bone-faint">解答例がありません</p>;
  }
  return (
    <div>
      <ul className="space-y-1">
        {shown.map((s, i) => {
          const names = playerNamesByKey?.get(s.key) ?? [];
          const isMyAnswer = !!myKey && s.key === myKey;
          const others = isMyAnswer ? names.filter((n) => n !== '(you)') : names;
          return (
            <li
              key={s.key}
              className={cn(
                'flex flex-wrap items-baseline gap-x-2 gap-y-1 border-l-2 px-3 py-2',
                isMyAnswer
                  ? 'border-blood bg-blood/[0.08]'
                  : others.length > 0
                    ? 'border-cyber/50 bg-cyber/[0.04]'
                    : 'border-[var(--hair)] bg-black/25',
              )}
            >
              <span className="numeral text-[10px] text-bone-faint">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="display text-[15px] leading-tight text-bone">{s.formula}</span>
              <span className="numeral text-[12px] text-brass">= {target}</span>
              {isMyAnswer && (
                <span className="numeral ml-auto text-[10px] tracking-[0.16em] text-[#ff8a9b]">
                  YOU
                </span>
              )}
              {others.length > 0 && (
                <span className="numeral ml-auto text-[10px] tracking-[0.1em] text-cyber/80">
                  {others.join(' / ')}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {remain > 0 && (
        <div className="mt-3 flex justify-center">
          <Button variant="soft" onClick={() => setPage((p) => p + 1)} className="py-2 text-[10px]">
            さらに見る（残り {remain}）
          </Button>
        </div>
      )}
      <p className="numeral mt-2.5 text-center text-[10px] tracking-[0.14em] text-bone-faint">
        TOTAL {solutions.length}
      </p>
    </div>
  );
}

const COUNTDOWN_MS = 3000;

export function GameScreen({ ctrl }: { ctrl: UseRoom }) {
  const { room, players, uid, isGM } = ctrl;
  const [, setTick] = useState(0);
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
  const nameOf = (id: string) => players.find((p) => p.uid === id)?.name ?? '退室したプレイヤー';
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

  // 解答例とプレイヤーの紐付け（等価判定key → [名前]）
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
  const remainSlots = Math.max(0, targetCap - liveCorrectCount);

  return (
    <div className="relative mx-auto w-full max-w-6xl px-4 py-5">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="grid-overlay absolute inset-0" />
      </div>

      {/* ヘッダー */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Round</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="numeral text-[30px] leading-none text-bone">
              {String(roundNo).padStart(2, '0')}
            </span>
            <span className="numeral text-[13px] text-bone-faint">
              / {String(settings.roundCount).padStart(2, '0')}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {settings.showDifficulty && typeof r.solutionCount === 'number' && (
              <span className="chip">
                <Icon name="diamond" className="h-2.5 w-2.5" />
                解 {r.solutionCount} 通り
              </span>
            )}
            <span className="chip">{settings.unlimitedTime ? 'No limit' : `${settings.timeLimitSec}s`}</span>
          </div>
        </div>

        <div className="text-right">
          <div className="eyebrow">{settings.unlimitedTime ? 'Elapsed' : 'Time left'}</div>
          <div
            className={cn(
              'numeral mt-1 text-[34px] leading-none',
              remainMs !== null && remainMs < 10000 ? 'text-[#ff6b7f]' : 'text-bone',
              showMask && 'text-bone-faint',
            )}
          >
            {showMask ? '—.—' : ((remainMs ?? displayElapsed) / 1000).toFixed(1)}
            <span className="ml-1 text-[13px] text-bone-faint">s</span>
          </div>
        </div>
      </div>

      {timeFrac !== null && !showMask && (
        <div className="mb-4 h-[3px] w-full overflow-hidden bg-[var(--hair-soft)]">
          <div
            className={cn('h-full transition-all duration-100', timeFrac < 0.25 ? 'bg-blood' : 'bar-track')}
            style={{ width: `${Math.max(0, timeFrac * 100)}%` }}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_290px]">
        <Card className="p-4 sm:p-6">
          {/* 入賞枠ステータス */}
          {!judging && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[var(--hair)] pb-3">
              <span className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 animate-breathe bg-cyber" />
                <span className="eyebrow">Slots</span>
                <span className="numeral text-[13px] text-bone">
                  {liveCorrectCount}
                  <span className="text-bone-faint"> / {targetCap}</span>
                </span>
                <span className="numeral text-[10px] tracking-[0.12em] text-bone-faint">
                  {liveCorrectCount < targetCap ? `${remainSlots} 枠 受付中` : '定員到達'}
                </span>
              </span>
              <span className="text-[10px] text-bone-faint">
                未正解者が全員パスすると終了
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
                ? 'ラウンド終了。結果を表示しています'
                : iAmSolved
                  ? `正解済み（${myLiveRank}位）— 式: ${myAnswer?.formula}`
                  : undefined
            }
            passed={!!myAnswer?.passed}
            roundKey={r.roundIndex}
            isCountdown={showMask}
            onSolved={(f, k) => ctrl.submitAnswer(f, k)}
            onPass={() => ctrl.passRound()}
            onCancelPass={room.status === 'playing' ? () => ctrl.cancelPass() : undefined}
          />
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="eyebrow">Players — {String(players.length).padStart(2, '0')}</span>
              <button
                onClick={ctrl.leaveRoom}
                className="numeral text-[10px] tracking-[0.14em] text-bone-faint transition hover:text-[#ff8a9b]"
                title="対戦を離れます"
              >
                途中退出
              </button>
            </div>

            <ul className="space-y-px">
              {[...players]
                .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                .map((p, idx) => {
                  const a = answers[p.uid];
                  const solveRankIndex = liveCorrectAnswers.findIndex(([id]) => id === p.uid);
                  const hasSolved = solveRankIndex >= 0;
                  const solveRank = hasSolved ? solveRankIndex + 1 : null;
                  const isPassed = a?.passed;

                  return (
                    <li
                      key={p.uid}
                      className={cn(
                        'flex items-center justify-between gap-2 border-l-2 px-2.5 py-2 transition',
                        p.uid === uid
                          ? 'border-blood bg-blood/[0.07]'
                          : hasSolved
                            ? 'border-cyber/60 bg-cyber/[0.03]'
                            : 'border-transparent bg-black/20',
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="numeral w-4 shrink-0 text-[10px] text-bone-faint">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <span className="min-w-0 truncate text-[13px] text-bone">{p.name}</span>
                        {p.uid === room.gmUid && (
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
                      <span className="flex shrink-0 items-center gap-2">
                        <span
                          className={cn(
                            'numeral text-[9px] tracking-[0.12em]',
                            hasSolved
                              ? 'text-cyber'
                              : isPassed
                                ? 'text-bone-faint'
                                : 'text-brass',
                          )}
                        >
                          {hasSolved
                            ? `NO.${ORDINAL[solveRank! - 1] ?? solveRank}`
                            : isPassed
                              ? 'PASS'
                              : 'THINK'}
                        </span>
                        <span className="numeral min-w-6 border border-[var(--hair)] px-1.5 py-0.5 text-center text-[11px] text-brass">
                          {p.score ?? 0}
                        </span>
                      </span>
                    </li>
                  );
                })}
            </ul>

            {/* 自分の状態 */}
            {!judging && (
              <div className="mt-3">
                {iAmSolved ? (
                  <div className="animate-rise border border-cyber/45 bg-cyber/[0.06] px-3 py-2.5 text-center">
                    <div className="numeral text-[11px] tracking-[0.22em] text-cyber">
                      ACQUIRED — NO.{myLiveRank}
                    </div>
                    <div className="mt-1 text-[11px] leading-relaxed text-bone-dim">
                      他のプレイヤーの解答、または全員パスまで待機
                    </div>
                  </div>
                ) : myAnswer?.passed ? (
                  <div className="border border-[var(--hair)] bg-black/25 px-3 py-2.5 text-center">
                    <div className="numeral text-[11px] tracking-[0.22em] text-bone-dim">PASSED</div>
                    <div className="mt-1 text-[11px] leading-relaxed text-bone-faint">
                      ひらめいたらそのまま解き直せます
                    </div>
                  </div>
                ) : (
                  <div className="border border-[var(--hair)] bg-black/25 px-3 py-2.5 text-center">
                    <div className="numeral text-[11px] tracking-[0.18em] text-brass">
                      REMAIN {remainSlots}
                    </div>
                    <div className="mt-1 text-[11px] leading-relaxed text-bone-faint">
                      解けないときはパス（取り消し可）
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

          <ChatPanel ctrl={ctrl} />
        </div>
      </div>

      {/* エラー通知 */}
      {ctrl.error && (
        <div className="animate-rise fixed inset-x-0 top-3 z-[75] mx-auto flex w-[94%] max-w-lg items-start gap-2.5 border-l-2 border-blood bg-[#1a0a0e] px-3.5 py-3 text-left text-[12px] leading-relaxed text-[#ffc2ca] shadow-2xl">
          <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 text-[#ff8a9b]" />
          <span className="min-w-0 flex-1">{ctrl.error}</span>
          <button
            onClick={() => ctrl.setError(null)}
            className="shrink-0 text-[#ff8a9b] transition hover:text-bone"
            aria-label="閉じる"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* カウントダウン */}
      {showMask && (
        <div className="animate-fade-in fixed inset-0 z-40 flex flex-col items-center justify-center bg-ink/95">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="grid-overlay absolute inset-0" />
          </div>
          <span className="eyebrow relative">Standby</span>
          {count > 0 && (
            <span
              key={count}
              className="animate-count display relative mt-2 text-[9rem] leading-none text-bone sm:text-[12rem]"
            >
              {count}
            </span>
          )}
          <div className="relative mt-4 flex items-center gap-3">
            <span className="h-px w-10 bg-[var(--hair)]" />
            <span className="numeral text-[10px] tracking-[0.34em] text-bone-dim">
              ROUND {String(roundNo).padStart(2, '0')}
            </span>
            <span className="h-px w-10 bg-[var(--hair)]" />
          </div>
        </div>
      )}

      {room?.status === 'judging' && !r?.endedAt && (
        <div className="animate-fade-in fixed inset-x-0 bottom-0 z-20 flex justify-center p-4">
          <div className="flex items-center gap-3 border border-[var(--hair)] bg-ink-2/95 px-5 py-3">
            <Icon name="reset" className="h-3.5 w-3.5 animate-spin-slow text-cyber" />
            <span className="numeral text-[10px] tracking-[0.2em] text-bone-dim">JUDGING…</span>
          </div>
        </div>
      )}

      {/* ラウンド結果 */}
      {judging && (
        <div className="animate-fade-in fixed inset-0 z-30 flex items-end justify-center bg-black/85 p-4 sm:items-center">
          <Card accent className="animate-rise max-h-[90vh] w-full max-w-lg overflow-y-auto p-5 sm:p-6">
            {hasAnswers ? (
              <div className="text-center">
                <div className="eyebrow">Result</div>
                {r.winnerUid && (
                  <>
                    <div className="mt-2 flex items-center justify-center gap-2">
                      <Icon name="award" className="h-5 w-5 text-brass" />
                      <span className="display text-[26px] leading-tight text-bone sm:text-[30px]">
                        {nameOf(r.winnerUid)}
                      </span>
                    </div>
                    {closeCall && (
                      <div className="numeral mt-2 inline-block border border-blood/50 bg-blood/10 px-3 py-1 text-[10px] tracking-[0.2em] text-[#ff8a9b]">
                        PHOTO FINISH
                      </div>
                    )}
                  </>
                )}

                <div className="mt-5 text-left">
                  <div className="flex items-center justify-between">
                    <span className="eyebrow">Answers</span>
                    <span className="numeral text-[10px] text-bone-faint">{ranked.length}</span>
                  </div>
                  <Rule className="my-2.5" />
                  <ul className="space-y-1">
                    {ranked.map(([id, res]) => (
                      <li
                        key={id}
                        className={cn(
                          'border-l-2 px-3 py-2',
                          res.rank === 1
                            ? 'border-brass bg-brass/[0.06]'
                            : 'border-[var(--hair)] bg-black/25',
                        )}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="flex min-w-0 items-baseline gap-2">
                            <span className="numeral text-[10px] text-bone-faint">
                              {String(res.rank).padStart(2, '0')}
                            </span>
                            <span className="truncate text-[12px] text-bone">
                              {nameOf(id)}
                              {id === uid && (
                                <span className="numeral ml-1 text-[9px] text-[#ff8a9b]">YOU</span>
                              )}
                            </span>
                            {res.gained > 0 && (
                              <span className="numeral text-[10px] text-cyber">+{res.gained}</span>
                            )}
                          </span>
                          <span className="numeral shrink-0 text-[11px] text-bone-dim">
                            {formatMs(res.adjustedElapsedMs)}
                          </span>
                        </div>
                        <div className="display mt-0.5 text-[16px] leading-tight text-bone">
                          {res.formula}
                          <span className="numeral ml-1.5 text-[12px] text-brass">= {r.target}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="eyebrow">
                  No answer — {r.outcome === 'timeup' ? 'time up' : 'all passed'}
                </div>
                <div className="display mt-2 text-[20px] text-bone">誰も正解できませんでした</div>
              </div>
            )}

            <div className="mt-5">
              <Rule />
              <div className="mt-3 mb-2 text-center">
                <span className="eyebrow">Solutions</span>
              </div>
              <SolutionsList
                solutions={allSols}
                target={r.target}
                playerNamesByKey={playerNamesByKey}
                myKey={myKey}
              />
            </div>

            <div className="mt-6 flex justify-center">
              {isGM ? (
                <Button onClick={ctrl.nextRound}>
                  <span>次の問題へ</span>
                  <Icon name="play" className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <span className="numeral text-[10px] tracking-[0.16em] text-bone-faint">
                  AWAITING GAME MASTER…
                </span>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
