import type { Op } from '../lib/solver';
import type { Settings } from '../lib/types';
import { Chip, Field, Toggle, inputCls } from './ui';

interface Props {
  settings: Settings;
  readOnly?: boolean;
  onChange: (patch: Partial<Settings>) => void;
}

export function SettingsPanel({ settings, readOnly, onChange }: Props) {
  const s = settings;
  const dis = !!readOnly;
  const toggleOp = (op: Op) => {
    const cur = new Set(s.allowedOperators);
    if (cur.has(op)) {
      if (cur.size === 1) return;
      cur.delete(op);
    } else cur.add(op);
    onChange({ allowedOperators: (['+', '-', '*', '/'] as Op[]).filter((o) => cur.has(o)) });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="数字の個数">
          <select
            className={inputCls}
            disabled={dis}
            value={s.numberCount}
            onChange={(e) => onChange({ numberCount: Number(e.target.value) })}
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
            disabled={dis}
            value={s.rangeMin}
            min={0}
            max={20}
            onChange={(e) => onChange({ rangeMin: Number(e.target.value) })}
          />
        </Field>
        <Field label="数字の最大値">
          <input
            type="number"
            className={inputCls}
            disabled={dis}
            value={s.rangeMax}
            min={1}
            max={30}
            onChange={(e) => onChange({ rangeMax: Number(e.target.value) })}
          />
        </Field>
        <Field label="目標値モード">
          <select
            className={inputCls}
            disabled={dis}
            value={s.targetMode}
            onChange={(e) => onChange({ targetMode: e.target.value as Settings['targetMode'] })}
          >
            <option value="fixed">固定</option>
            <option value="random">毎回ランダム</option>
          </select>
        </Field>
        {s.targetMode === 'fixed' ? (
          <Field label="目標値">
            <input
              type="number"
              className={inputCls}
              disabled={dis}
              value={s.targetValue}
              onChange={(e) => onChange({ targetValue: Number(e.target.value) })}
            />
          </Field>
        ) : (
          <Field label="目標値の範囲">
            <div className="flex items-center gap-1">
              <input
                type="number"
                className={inputCls}
                disabled={dis}
                value={s.randomTargetMin}
                onChange={(e) => onChange({ randomTargetMin: Number(e.target.value) })}
              />
              <span className="text-slate-400">〜</span>
              <input
                type="number"
                className={inputCls}
                disabled={dis}
                value={s.randomTargetMax}
                onChange={(e) => onChange({ randomTargetMax: Number(e.target.value) })}
              />
            </div>
          </Field>
        )}
        <Field label="ラウンド数">
          <input
            type="number"
            className={inputCls}
            disabled={dis}
            min={1}
            max={50}
            value={s.roundCount}
            onChange={(e) => onChange({ roundCount: Number(e.target.value) })}
          />
        </Field>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold text-slate-300">使用可能な演算子</div>
        <div className="flex flex-wrap gap-2">
          {(['+', '-', '*', '/'] as Op[]).map((op) => (
            <Chip
              key={op}
              disabled={dis}
              active={s.allowedOperators.includes(op)}
              onClick={() => toggleOp(op)}
            >
              {{ '+': '＋', '-': '−', '*': '×', '/': '÷' }[op]}
            </Chip>
          ))}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Toggle
          label="出題数字の重複を許可"
          disabled={dis}
          checked={s.allowDuplicateNumbers}
          onChange={(v) => onChange({ allowDuplicateNumbers: v })}
        />
        <Toggle
          label="途中結果を整数のみに制限"
          disabled={dis}
          checked={s.integerOnly}
          onChange={(v) => onChange({ integerOnly: v })}
        />
        <Toggle
          label="制限時間なし（全員パスで次へ）"
          disabled={dis}
          checked={s.unlimitedTime}
          onChange={(v) => onChange({ unlimitedTime: v })}
        />
        <Toggle
          label="解の通り数を問題に表示"
          disabled={dis}
          checked={s.showDifficulty}
          onChange={(v) => onChange({ showDifficulty: v })}
        />
        <Toggle
          label="開始に全員Readyを必須にする"
          disabled={dis}
          checked={s.requireAllReady}
          onChange={(v) => onChange({ requireAllReady: v })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {!s.unlimitedTime && (
          <Field label="1問の制限時間(秒)">
            <input
              type="number"
              className={inputCls}
              disabled={dis}
              min={5}
              max={300}
              value={s.timeLimitSec}
              onChange={(e) => onChange({ timeLimitSec: Number(e.target.value) })}
            />
          </Field>
        )}
        <Field label="得点方式">
          <select
            className={inputCls}
            disabled={dis}
            value={s.scoringMode}
            onChange={(e) => onChange({ scoringMode: e.target.value as Settings['scoringMode'] })}
          >
            <option value="rank">順位傾斜配点（1位ほど高得点）</option>
            <option value="first">早押し（1位のみ1点）</option>
            <option value="flat">正解者一律（入賞枠全員1点）</option>
          </select>
        </Field>
        {s.scoringMode !== 'first' && (
          <Field label="何位まで点数をつけるか">
            <select
              className={inputCls}
              disabled={dis}
              value={s.maxRankCount ?? 3}
              onChange={(e) => onChange({ maxRankCount: Number(e.target.value) })}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}位まで（{s.scoringMode === 'rank' ? Array.from({ length: n }, (_, i) => `${n - i}点`).join(', ') : '各1点'}）
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="お手つきペナルティ">
          <select
            className={inputCls}
            disabled={dis}
            value={s.penaltyMode}
            onChange={(e) => onChange({ penaltyMode: e.target.value as Settings['penaltyMode'] })}
          >
            <option value="lock">入力ロック</option>
            <option value="none">なし</option>
          </select>
        </Field>
      </div>
      {dis && (
        <p className="text-xs text-slate-400">
          設定を変更できるのはゲームマスター（ルーム作成者）だけです。
        </p>
      )}
    </div>
  );
}
