import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generatePuzzleAsync, type Puzzle } from '../lib/puzzle';
import { DEFAULT_SETTINGS, type Settings } from '../lib/types';
import { PlayArea } from './PlayArea';
import { FactorArea } from './FactorArea';
import {
  FACTOR_PRIME_OPTIONS,
  factorGenerationIssue,
  factorFormula,
  generateFactorPuzzle,
  type FactorPuzzle,
} from '../lib/factor';
import { Button, Card, Chip, Field, Toggle } from './ui';
import { IconArrowRight, IconCheck, IconGear, IconReset, IconSpark } from './icons';
import { playSe } from '../lib/audio';
import { cn } from '../utils/cn';

export function SoloScreen({ onExit }: { onExit: () => void }) {
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS, unlimitedTime: true });
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [factorPuzzle, setFactorPuzzle] = useState<FactorPuzzle | null>(null);
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
    setFactorPuzzle(null);
    setCleared(null);
    setError(null);
    setProgress({ attempts: 0, elapsedMs: 0 });
    // 素因数分解は同期生成（軽いのでスピナーなしで即出す）
    if (s.gameMode === 'factor') {
      const fp = generateFactorPuzzle({
        digits: s.factorDigits,
        minPrime: s.factorMinPrime,
        maxPrime: s.factorMaxPrime,
        countMin: s.factorCountMin,
        countMax: s.factorCountMax,
      });
      setLoading(false);
      setProgress(null);
      if (!fp) {
        const issue = factorGenerationIssue({
          digits: s.factorDigits,
          minPrime: s.factorMinPrime,
          maxPrime: s.factorMaxPrime,
          countMin: s.factorCountMin,
          countMax: s.factorCountMax,
        });
        setError(
          issue
            ? `この設定では合成数を作れません: ${issue}`
            : 'この設定では条件に合う合成数を作れませんでした。桁数・下限素数・上限素数・素因数の個数を見直してください。',
        );
        return;
      }
      setFactorPuzzle(fp);
      setStartedAt(Date.now());
      setSolPage(0);
      setPuzzleSeq((n) => n + 1);
      return;
    }
    // 生成はタイムスライス方式なので、重い設定でも画面は固まらない。
    // 時間で勝手に打ち切らず、見つかるか「探索をあきらめる」まで続ける
    const p = await generatePuzzleAsync(s, {
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
        'この設定では解ける問題が見つかりませんでした。数字の範囲・演算子・目標値をゆるめてみてください。',
      );
      return;
    }
    setPuzzle(p);
    setStartedAt(Date.now());
    setSolPage(0);
    setPuzzleSeq((n) => n + 1);
  }, []);

  /** 探索を途中であきらめる（進行中の生成は seq 不一致で破棄される） */
  const cancelGeneration = () => {
    seqRef.current++;
    setLoading(false);
    setProgress(null);
    setShowSettings(true);
    setError('問題の探索をあきらめました。設定を見直して、もう一度お試しください。');
  };

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
          <div className="label jp mb-2 tracking-[.18em] text-cyan-200/70">ゲームの種類</div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Chip
              disabled={loading}
              active={settings.gameMode === 'make10'}
              onClick={() => setSettings((s) => ({ ...s, gameMode: 'make10' }))}
            >
              メイクテン
            </Chip>
            <Chip
              disabled={loading}
              active={settings.gameMode === 'factor'}
              onClick={() => setSettings((s) => ({ ...s, gameMode: 'factor' }))}
            >
              素因数分解
            </Chip>
          </div>
          {settings.gameMode === 'make10' ? (
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
          ) : (
          <>
            <Field label="進め方（スタイル）">
              <div className="flex flex-wrap gap-2">
                <Chip
                  active={settings.factorStyle === 'accumulate'}
                  onClick={() => setSettings((s) => ({ ...s, factorStyle: 'accumulate' }))}
                >
                  積み上げ式（残りが見えない）
                </Chip>
                <Chip
                  active={settings.factorStyle === 'divide'}
                  onClick={() => setSettings((s) => ({ ...s, factorStyle: 'divide' }))}
                >
                  割り算式（目標が割れていく）
                </Chip>
              </div>
            </Field>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="分解する数の桁数">
                <select
                  className="input"
                  value={settings.factorDigits}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, factorDigits: Number(e.target.value) }))
                  }
                >
                  {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>
                      {n}桁
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="下限素数（素因数の最小）">
                <select
                  className="input"
                  value={settings.factorMinPrime}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setSettings((s) => ({
                      ...s,
                      factorMinPrime: v,
                      factorMaxPrime: Math.max(v, s.factorMaxPrime),
                    }));
                  }}
                >
                  {FACTOR_PRIME_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p} 以上
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="上限素数（素因数の最大）">
                <select
                  className="input"
                  value={settings.factorMaxPrime}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setSettings((s) => ({
                      ...s,
                      factorMaxPrime: Math.max(s.factorMinPrime, v),
                    }));
                  }}
                >
                  {FACTOR_PRIME_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p} 以下
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="素因数の個数（最小）">
                <select
                  className="input"
                  value={settings.factorCountMin}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setSettings((s) => ({
                      ...s,
                      factorCountMin: v,
                      factorCountMax: Math.max(v, s.factorCountMax),
                    }));
                  }}
                >
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n} value={n}>
                      {n}個
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="素因数の個数（最大）">
                <select
                  className="input"
                  value={settings.factorCountMax}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setSettings((s) => ({
                      ...s,
                      factorCountMax: Math.max(s.factorCountMin, v),
                    }));
                  }}
                >
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n} value={n}>
                      {n}個
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <p className="jp mt-3 text-[11px] leading-relaxed text-slate-400">
              素因数の下限・上限は2〜997のすべての素数から選べます。組み合わせによっては作れない場合があります。
            </p>
          </>
          )}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {settings.gameMode === 'make10' && (
            <Toggle
              label="途中結果を整数のみに制限"
              checked={settings.integerOnly}
              onChange={(v) => setSettings((s) => ({ ...s, integerOnly: v }))}
            />
            )}
            <Toggle
              label={settings.gameMode === 'factor' ? '素因数の個数を表示' : '解の通り数を表示'}
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
            <span className="jp text-[11px] text-slate-400">
              見つかるまで探索を続けます（時間で勝手に打ち切りません）
            </span>
            {progress && (
              <span className="num text-[10px] tabular-nums text-slate-500">
                {(progress.elapsedMs / 1000).toFixed(1)}s / {progress.attempts} trials
                {progress.elapsedMs > 1200 && ' // 重い設定のため時間がかかっています'}
              </span>
            )}
            <Button variant="ghost" className="px-4 py-2.5 text-[11px]" onClick={cancelGeneration}>
              探索をあきらめる
            </Button>
          </div>
        </Card>
      )}

      {(puzzle || factorPuzzle) && !loading && (
        <>
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="chip text-cyan-200/90">
                PUZZLE <b className="num ml-1 text-white">{String(puzzleSeq).padStart(2, '0')}</b>
              </span>
              {settings.showDifficulty &&
                (puzzle ? (
                  <span className="chip border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-200">
                    SOLUTIONS {puzzle.solutionCount}
                  </span>
                ) : factorPuzzle ? (
                  <span className="chip border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-200">
                    素因数 {factorPuzzle.factors.length}個
                  </span>
                ) : null)}
            </div>
            <span className="jp text-[10px] text-slate-500">オフラインモード</span>
          </div>

          <Card>
            {puzzle ? (
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
            ) : factorPuzzle ? (
              <FactorArea
                value={factorPuzzle.value}
                factorStyle={settings.factorStyle}
                penaltyMode={settings.penaltyMode}
                disabled={!!cleared}
                roundKey={`solo-${puzzleSeq}`}
                onSolved={onSolved}
              />
            ) : null}
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
                    {puzzle
                      ? `${cleared.formula} = ${puzzle.target}`
                      : `${factorPuzzle?.value.toLocaleString()} = ${cleared.formula}`}
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
              <div className="label text-cyan-200/80">
                {!puzzle && factorPuzzle ? 'ANSWER // 素因数分解' : 'SOLUTIONS'}
              </div>
              {!puzzle && factorPuzzle ? (
                <>
                  <ul className="mt-2 space-y-1">
                    <li
                      className={cn(
                        'num border-l-2 px-3 py-1.5 text-[13px] font-bold',
                        cleared?.formula
                          ? 'border-emerald-400/80 bg-emerald-500/10 text-emerald-100'
                          : 'border-white/12 bg-white/[0.03] text-amber-200',
                      )}
                    >
                      {factorPuzzle.value.toLocaleString()} = {factorFormula(factorPuzzle.factors)}
                      {!!cleared?.formula && (
                        <span className="jp ml-2 text-[10px] text-emerald-300">あなたの解答</span>
                      )}
                    </li>
                  </ul>
                  <p className="num mt-2 text-center text-[10px] tracking-[.2em] text-slate-500">
                    TOTAL 1
                  </p>
                </>
              ) : (
                <>
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
                      {s.formula} = {puzzle?.target}
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
                TOTAL {puzzle?.solutionCount}
              </p>
                </>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
