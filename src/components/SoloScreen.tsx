import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generatePuzzleAsync, type Puzzle } from '../lib/puzzle';
import { DEFAULT_SETTINGS, type Settings } from '../lib/types';
import { PlayArea } from './PlayArea';
import { Button, Card, Field, Icon, Rule, Spinner, Toggle, inputCls } from './ui';
import { cn } from '../utils/cn';

export function SoloScreen({ onExit }: { onExit: () => void }) {
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS, unlimitedTime: true });
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [showSettings, setShowSettings] = useState(true);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [cleared, setCleared] = useState<{ ms: number; formula: string; key: string } | null>(
    null,
  );
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
    <div className="relative mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="grid-overlay absolute inset-0" />
      </div>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">Solo practice — offline</span>
          <h2 className="display mt-2 text-[2rem] leading-none text-bone sm:text-[2.4rem]">
            ひとり練習
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="soft" onClick={() => setShowSettings((v) => !v)} className="py-2.5">
            <Icon name="gear" className="h-3.5 w-3.5" />
            <span>設定</span>
          </Button>
          <Button
            variant="ghost"
            onClick={onExit}
            className="border border-[var(--hair)] py-2.5 text-bone-dim"
          >
            <Icon name="exit" className="h-3.5 w-3.5" />
            <span>トップへ</span>
          </Button>
        </div>
      </div>

      {showSettings && (
        <Card className="animate-rise mb-4">
          <div className="eyebrow mb-3">Puzzle settings</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="数字の個数">
              <select
                className={inputCls}
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
            <Field label="数字の最小値">
              <input
                type="number"
                className={inputCls}
                min={0}
                max={20}
                value={settings.rangeMin}
                onChange={(e) => setSettings((s) => ({ ...s, rangeMin: Number(e.target.value) }))}
              />
            </Field>
            <Field label="数字の最大値">
              <input
                type="number"
                className={inputCls}
                min={1}
                max={30}
                value={settings.rangeMax}
                onChange={(e) => setSettings((s) => ({ ...s, rangeMax: Number(e.target.value) }))}
              />
            </Field>
            <Field label="目標値">
              <input
                type="number"
                className={inputCls}
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
          <Button className="mt-4 w-full py-3" onClick={() => void newPuzzle(settings)} disabled={loading}>
            <Icon name="play" className="h-3.5 w-3.5" />
            <span>この設定で新しい問題</span>
          </Button>
        </Card>
      )}

      {error && (
        <div className="animate-rise mb-4 flex items-start gap-2.5 border-l-2 border-blood bg-blood/10 px-3.5 py-2.5 text-[12px] leading-relaxed text-[#ffb3bd]">
          <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <Card className="mb-4 py-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <Spinner className="h-7 w-7" />
            <span className="eyebrow">Generating puzzle</span>
            {progress && (
              <span className="numeral text-[10px] tracking-[0.12em] text-bone-faint">
                {(progress.elapsedMs / 1000).toFixed(1)}秒 / {progress.attempts}通り試行
                {progress.elapsedMs > 1200 && '（重い設定なので時間がかかっています）'}
              </span>
            )}
          </div>
        </Card>
      )}

      {puzzle && !loading && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-2">
              {settings.showDifficulty && (
                <span className="chip">
                  <Icon name="diamond" className="h-2.5 w-2.5" />
                  解 {puzzle.solutionCount} 通り
                </span>
              )}
            </div>
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
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={() => void newPuzzle(settings)} disabled={loading}>
              <span>次の問題</span>
              <Icon name="play" className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="soft"
              onClick={() => setCleared({ ms: 0, formula: '', key: '' })}
              disabled={!!cleared}
            >
              ギブアップ（解答例を見る）
            </Button>
          </div>
          {cleared && (
            <Card className="mt-4">
              {cleared.formula ? (
                <div className="mb-4 border border-cyber/40 bg-cyber/[0.06] px-4 py-3 text-center">
                  <div className="eyebrow text-cyber/80">Cleared</div>
                  <div className="display mt-1 text-[22px] leading-tight text-bone">
                    {cleared.formula}
                    <span className="numeral ml-2 text-[13px] text-brass">= {puzzle.target}</span>
                  </div>
                  <div className="numeral mt-1.5 flex items-center justify-center gap-1.5 text-[11px] tracking-[0.14em] text-cyber">
                    <Icon name="clock" className="h-3 w-3" />
                    {(cleared.ms / 1000).toFixed(2)} s
                  </div>
                </div>
              ) : (
                <div className="mb-4 border border-[var(--hair)] bg-black/30 px-4 py-2.5 text-center">
                  <div className="numeral text-[10px] tracking-[0.24em] text-bone-faint">
                    GAVE UP — SOLUTIONS BELOW
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="eyebrow">Solutions</span>
                <span className="numeral text-[10px] tracking-[0.12em] text-bone-faint">
                  {String(solutions.length).padStart(2, '0')}
                </span>
              </div>
              <Rule className="my-2.5" />
              <ul className="space-y-1">
                {currentSols.map((s) => {
                  // 表示文字列ではなく等価判定キーで照合する。重複排除で代表として
                  // 残った解答例の文字列が、プレイヤーが実際に入力した式の文字列と
                  // 異なっていても、数式として同じなら「あなたの解答」として扱う。
                  const isMyAnswer = !!cleared?.formula && cleared.key === s.key;
                  return (
                    <li
                      key={s.key}
                      className={cn(
                        'flex flex-wrap items-baseline gap-x-2 border-l-2 px-3 py-1.5',
                        isMyAnswer
                          ? 'border-cyber/60 bg-cyber/[0.07]'
                          : 'border-[var(--hair)] bg-black/25',
                      )}
                    >
                      <span className="display text-[15px] text-bone">{s.formula}</span>
                      <span className="numeral text-[12px] text-brass">= {puzzle.target}</span>
                      {isMyAnswer && (
                        <span className="numeral ml-auto text-[9px] tracking-[0.14em] text-cyber">
                          YOUR ANSWER
                        </span>
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
              <p className="numeral mt-2.5 text-center text-[10px] tracking-[0.14em] text-bone-faint">
                DISTINCT SOLUTIONS — {puzzle.solutionCount}
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
