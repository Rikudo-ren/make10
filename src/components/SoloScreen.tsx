import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generatePuzzleAsync, type Puzzle } from '../lib/puzzle';
import { DEFAULT_SETTINGS, type Settings } from '../lib/types';
import { PlayArea } from './PlayArea';
import { Button, Card, Field, Toggle, inputCls } from './ui';
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
    <div className="relative mx-auto w-full max-w-3xl px-4 py-6">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="grid-overlay absolute inset-0" />
        <div className="drift absolute -left-10 top-10 h-56 w-56 rounded-full bg-indigo-600/15 blur-3xl" />
      </div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <div className="chip mb-1.5 inline-block border-indigo-400/40 bg-indigo-500/15 text-indigo-100">
            SOLO PRACTICE
          </div>
          <div className="text-3xl font-black text-white">ひとり練習</div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="soft" onClick={() => setShowSettings((v) => !v)}>
            ⚙ 設定
          </Button>
          <Button variant="ghost" onClick={onExit}>
            トップへ
          </Button>
        </div>
      </div>

      {showSettings && (
        <Card className="mb-4">
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
          <Button className="mt-4 w-full" onClick={() => void newPuzzle(settings)} disabled={loading}>
            ▶ この設定で新しい問題
          </Button>
        </Card>
      )}

      {error && (
        <p className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      {loading && (
        <Card className="mb-4 py-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-indigo-300" />
            <span className="text-sm font-bold text-slate-300">問題を準備中…</span>
            {progress && (
              <span className="text-[11px] tabular-nums text-slate-500">
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
                <span className="chip border-violet-400/40 bg-violet-500/15 text-violet-100">
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
              次の問題 ▶
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
              {cleared.formula && (
                <div className="mb-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-center">
                  <div className="text-[10px] font-black tracking-widest text-emerald-300">
                    YOUR ANSWER
                  </div>
                  <div className="text-lg font-black text-emerald-100">
                    {cleared.formula} = {puzzle.target}
                  </div>
                  <div className="mt-1 text-sm font-bold tabular-nums text-emerald-200">
                    ⏱ {(cleared.ms / 1000).toFixed(2)} 秒
                  </div>
                </div>
              )}
              {!cleared.formula && (
                <div className="mb-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-center">
                  <div className="text-[10px] font-black tracking-widest text-rose-300">
                    GIVE UP
                  </div>
                </div>
              )}
              <div className="text-xs font-black tracking-widest text-indigo-200">解答例</div>
              <ul className="mt-2 space-y-1">
                {currentSols.map((s) => {
                  // 表示文字列ではなく等価判定キーで照合する。重複排除で代表として
                  // 残った解答例の文字列が、プレイヤーが実際に入力した式の文字列と
                  // 異なっていても、数式として同じなら「あなたの解答」として扱う。
                  const isMyAnswer = !!cleared?.formula && cleared.key === s.key;
                  return (
                    <li
                      key={s.key}
                      className={cn(
                        'rounded-lg px-3 py-1.5 font-bold',
                        isMyAnswer
                          ? 'border border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
                          : 'bg-white/5 text-amber-200',
                      )}
                    >
                      {s.formula} = {puzzle.target}
                      {isMyAnswer && (
                        <span className="ml-2 text-xs text-emerald-300">← あなたの解答</span>
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
                    className="py-2 text-xs"
                  >
                    さらに解答例を見る（残り {solutions.length - (solPage + 1) * pageSize}件）
                  </Button>
                </div>
              )}
              <p className="mt-2 text-center text-[11px] text-slate-500">
                重複排除後の解: {puzzle.solutionCount} 通り
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
