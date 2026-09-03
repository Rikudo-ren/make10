import { useCallback, useEffect, useMemo, useState } from 'react';
import { generatePuzzle, type Puzzle } from '../lib/puzzle';
import { DEFAULT_SETTINGS, type Settings } from '../lib/types';
import { PlayArea } from './PlayArea';
import { Button, Card, Field, Toggle, inputCls } from './ui';
import { cn } from '../utils/cn';

export function SoloScreen({ onExit }: { onExit: () => void }) {
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS, unlimitedTime: true });
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [showSettings, setShowSettings] = useState(true);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [cleared, setCleared] = useState<{ ms: number; formula: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [solPage, setSolPage] = useState(0);
  const [loading, setLoading] = useState(false);

  const newPuzzle = useCallback((s: Settings) => {
    setLoading(true);
    // 一瞬次の問題が見えないよう、先にクリアしてから生成
    setPuzzle(null);
    setCleared(null);
    // 次フレームで生成（UIに「準備中」を出す）
    requestAnimationFrame(() => {
      const p = generatePuzzle(s);
      if (!p) {
        setError('この設定では解ける問題を生成できませんでした。設定を見直してください。');
        setLoading(false);
        return;
      }
      setError(null);
      setPuzzle(p);
      setStartedAt(Date.now());
      setSolPage(0);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    newPuzzle(settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSolved = (formula: string) => {
    const ms = Date.now() - startedAt;
    setCleared({ ms, formula });
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
          <Button className="mt-4 w-full" onClick={() => newPuzzle(settings)} disabled={loading}>
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
        <Card className="mb-4 py-10 text-center text-sm font-bold text-slate-400">問題を準備中…</Card>
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
            <Button onClick={() => newPuzzle(settings)} disabled={loading}>
              次の問題 ▶
            </Button>
            <Button
              variant="soft"
              onClick={() => setCleared({ ms: 0, formula: '' })}
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
                  const isMyAnswer = cleared?.formula === s;
                  return (
                    <li
                      key={s}
                      className={cn(
                        'rounded-lg px-3 py-1.5 font-bold',
                        isMyAnswer
                          ? 'border border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
                          : 'bg-white/5 text-amber-200',
                      )}
                    >
                      {s} = {puzzle.target}
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
