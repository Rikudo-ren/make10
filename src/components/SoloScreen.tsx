import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generatePuzzleAsync, type Puzzle } from '../lib/puzzle';
import { DEFAULT_SETTINGS, type Settings } from '../lib/types';
import { PlayArea } from './PlayArea';
import { Button, Card, Field, Toggle } from './ui';
import { IconArrowRight, IconCheck, IconGear, IconReset, IconSpark } from './icons';
import { playSe } from '../lib/audio';
import { cn } from '../utils/cn';

export function SoloScreen({ onExit }: { onExit: () => void }) {
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS, unlimitedTime: true });
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [showSettings, setShowSettings] = useState(true);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [cleared, setCleared] = useState<{ ms: number; formula: string; key: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [solPage, setSolPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ attempts: number; elapsedMs: number } | null>(null);
  const [puzzleSeq, setPuzzleSeq] = useState(0);
  const seqRef = useRef(0);

  const newPuzzle = useCallback(async (s: Settings) => {
    const mySeq = ++seqRef.current;
    setLoading(true);
    // 一瞬次の問題が見えないよう、先にクリアしてから生成
    setPuzzle(null);
    setCleared(null);
    setError(null);
    setProgress({ attempts: 0, elapsedMs: 0 });
    // 生成はタイムスライス方式なので、重い設定でも画面は固まらない
    const p = await generatePuzzleAsync(s, {
      deadlineMs: 3000,
      onProgress: (g) => {
        if (seqRef.current === mySeq) setProgress({ attempts: g.attempts, elapsedMs: g.elapsedMs });
      },
      shouldCancel: () => seqRef.current !== mySeq,
    });
    if (seqRef.current !== mySeq) return;
    setLoading(false);
    setProgress(null);
    if (!p) {
      setError(
        'この設定では時間内に解ける問題を作れませんでした。数字の範囲・演算子・目標値をゆるめてみてください。',
      );
      return;
    }
    setPuzzle(p);
    setStartedAt(Date.now());
    setSolPage(0);
    setPuzzleSeq((n) => n + 1);
  }, []);

  useEffect(() => {
    void newPuzzle(settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSolved = (formula: string, key: string) => {
    const ms = Date.now() - startedAt;
    setCleared({ ms, formula, key });
  };

  const solutions = useMemo(() => puzzle?.solutions ?? [], [puzzle]);
  const pageSize = 5;
  const currentSols = solutions.slice(0, (solPage + 1) * pageSize);
  const hasMoreSols = (solPage + 1) * pageSize < solutions.length;

  return (
    <div className="relative mx-auto w-full max-w-3xl px-4 py-6 pb-24">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="grid-overlay absolute inset-0" />
        <div className="absolute -left-10 top-10 h-56 w-56 rounded-full ambient-cyan" />
      </div>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label mb-1 text-cyan-300/70">SOLO PRACTICE</div>
          <div className="font-display text-[26px] leading-none font-black tracking-[.12em] text-white">
            ひとり練習
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="soft"
            className="gap-1.5 py-2.5 text-[10px]"
            onClick={() => {
              playSe('toggle');
              setShowSettings((v) => !v);
            }}
          >
            <IconGear size={12} /> 設定
          </Button>
          <Button variant="ghost" className="py-2.5 text-[10px]" onClick={onExit}>
            トップへ
          </Button>
        </div>
      </div>

      {showSettings && (
        <Card className="mb-3.5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="数字の個数">
              <select
                className="input"
                value={settings.numberCount}
                onChange={(e) => setSettings((s) => ({ ...s, numberCount: Number(e.target.value) }))}
              >
                {[3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}個
                  </option>
                ))}
              </select>
            </Field>
            <Field label="最小値">
              <input
                type="number"
                className="input num"
                min={0}
                max={20}
                value={settings.rangeMin}
                onChange={(e) => setSettings((s) => ({ ...s, rangeMin: Number(e.target.value) }))}
              />
            </Field>
            <Field label="最大値">
              <input
                type="number"
                className="input num"
                min={1}
                max={30}
                value={settings.rangeMax}
                onChange={(e) => setSettings((s) => ({ ...s, rangeMax: Number(e.target.value) }))}
              />
            </Field>
            <Field label="目標値">
              <input
                type="number"
                className="input num"
                value={settings.targetValue}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    targetMode: 'fixed',
                    targetValue: Number(e.target.value),
                  }))
                }
              />
            </Field>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Toggle
              label="途中結果を整数のみに制限"
              checked={settings.integerOnly}
              onChange={(v) => setSettings((s) => ({ ...s, integerOnly: v }))}
            />
            <Toggle
              label="解の通り数を表示"
              checked={settings.showDifficulty}
              onChange={(v) => setSettings((s) => ({ ...s, showDifficulty: v }))}
            />
          </div>
          <Button
            className="mt-3.5 w-full gap-2 py-3"
            onClick={() => void newPuzzle(settings)}
            disabled={loading}
          >
            <IconReset size={13} /> この設定で新しい問題
          </Button>
        </Card>
      )}

      {error && (
        <p className="jp mb-3.5 border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200">
          {error}
        </p>
      )}

      {loading && (
        <Card className="mb-3.5 py-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-300" />
            <span className="label text-cyan-200/80">GENERATING PUZZLE</span>
            {progress && (
              <span className="num text-[10px] tabular-nums text-slate-500">
                {(progress.elapsedMs / 1000).toFixed(1)}s / {progress.attempts} trials
                {progress.elapsedMs > 1200 && ' // 重い設定のため時間がかかっています'}
              </span>
            )}
          </div>
        </Card>
      )}

      {puzzle && !loading && (
        <>
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="chip text-cyan-200/90">
                PUZZLE <b className="num ml-1 text-white">{String(puzzleSeq).padStart(2, '0')}</b>
              </span>
              {settings.showDifficulty && (
                <span className="chip border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-200">
                  SOLUTIONS {puzzle.solutionCount}
                </span>
              )}
            </div>
            <span className="jp text-[10px] text-slate-500">オフラインモード</span>
          </div>

          <Card>
            <PlayArea
              roundKey={`solo-${puzzleSeq}`}
              numbers={puzzle.numbers}
              target={puzzle.target}
              allowedOperators={settings.allowedOperators}
              integerOnly={settings.integerOnly}
              penaltyMode={settings.penaltyMode}
              disabled={!!cleared}
              onSolved={onSolved}
            />
          </Card>

          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <Button onClick={() => void newPuzzle(settings)} disabled={loading} className="gap-1.5">
              <IconArrowRight size={13} /> 次の問題
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                playSe('pass');
                setCleared({ ms: 0, formula: '', key: '' });
              }}
              disabled={!!cleared}
              className="gap-1.5"
            >
              <IconSpark size={13} /> ギブアップ（解答例を見る）
            </Button>
          </div>

          {cleared && (
            <Card className="mt-3.5">
              {cleared.formula ? (
                <div className="mb-3 border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-center">
                  <div className="label text-emerald-300">CLEAR</div>
                  <div className="num text-[17px] font-black text-emerald-100">
                    {cleared.formula} = {puzzle.target}
                  </div>
                  <div className="num mt-1 flex items-center justify-center gap-1.5 text-[12px] font-bold text-emerald-200">
                    <IconCheck size={12} />
                    {(cleared.ms / 1000).toFixed(2)} sec
                  </div>
                </div>
              ) : (
                <div className="mb-3 border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-center">
                  <div className="label text-rose-300">GIVE UP</div>
                </div>
              )}
              <div className="label text-cyan-200/80">SOLUTIONS</div>
              <ul className="mt-2 space-y-1">
                {currentSols.map((s) => {
                  // 表示文字列ではなく等価判定キーで照合する
                  const isMyAnswer = !!cleared?.formula && cleared.key === s.key;
                  return (
                    <li
                      key={s.key}
                      className={cn(
                        'num border-l-2 px-3 py-1.5 text-[13px] font-bold',
                        isMyAnswer
                          ? 'border-emerald-400/80 bg-emerald-500/10 text-emerald-100'
                          : 'border-white/12 bg-white/[0.03] text-amber-200',
                      )}
                    >
                      {s.formula} = {puzzle.target}
                      {isMyAnswer && (
                        <span className="jp ml-2 text-[10px] text-emerald-300">あなたの解答</span>
                      )}
                    </li>
                  );
                })}
              </ul>
              {hasMoreSols && (
                <div className="mt-3 flex justify-center">
                  <Button
                    variant="soft"
                    onClick={() => setSolPage((p) => p + 1)}
                    className="py-2 text-[10px]"
                  >
                    さらに解答例を見る（残り {solutions.length - (solPage + 1) * pageSize}件）
                  </Button>
                </div>
              )}
              <p className="num mt-2 text-center text-[10px] tracking-[.2em] text-slate-500">
                TOTAL {puzzle.solutionCount}
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
