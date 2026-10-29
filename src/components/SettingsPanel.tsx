import type { Op } from '../lib/solver';
import type { Settings } from '../lib/types';
import { Chip, Field, Toggle, inputCls } from './ui';
import { FACTOR_PRIME_OPTIONS } from '../lib/factor';

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
      {/* ===== ゲームの種類（同じ部屋のまま切替できる） ===== */}
      <div className="border border-white/10 bg-black/25 p-3">
        <div className="label jp mb-2 tracking-[.18em] text-cyan-200/70">ゲームの種類</div>
        <div className="flex flex-wrap gap-2">
          <Chip
            disabled={dis}
            active={s.gameMode === 'make10'}
            onClick={() => onChange({ gameMode: 'make10' })}
          >
            メイクテン
          </Chip>
          <Chip
            disabled={dis}
            active={s.gameMode === 'factor'}
            onClick={() => onChange({ gameMode: 'factor' })}
          >
            素因数分解
          </Chip>
        </div>
        {s.gameMode === 'factor' && (
          <div className="mt-3 space-y-3">
            <Field label="進め方（スタイル）">
              <div className="flex flex-wrap gap-2">
                <Chip
                  disabled={dis}
                  active={s.factorStyle === 'accumulate'}
                  onClick={() => onChange({ factorStyle: 'accumulate' })}
                >
                  残りが見えない
                </Chip>
                <Chip
                  disabled={dis}
                  active={s.factorStyle === 'divide'}
                  onClick={() => onChange({ factorStyle: 'divide' })}
                >
                  割り算（目標が割れていく）
                </Chip>
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Field label="分解する数の桁数">
                <select
                  className={inputCls}
                  disabled={dis}
                  value={s.factorDigits}
                  onChange={(e) => onChange({ factorDigits: Number(e.target.value) })}
                >
                  <option value={0}>指定なし</option>
                  {Array.from({ length: 14 }, (_, i) => i + 2).map((n) => (
                    <option key={n} value={n}>
                      {n}桁
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="下限素数（素因数の最小）">
                <select
                  className={inputCls}
                  disabled={dis}
                  value={s.factorMinPrime}
                  onChange={(e) =>
                    onChange({
                      factorMinPrime: Number(e.target.value),
                      factorMaxPrime: Math.max(Number(e.target.value), s.factorMaxPrime),
                    })
                  }
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
                  className={inputCls}
                  disabled={dis}
                  value={s.factorMaxPrime}
                  onChange={(e) =>
                    onChange({
                      factorMaxPrime: Math.max(s.factorMinPrime, Number(e.target.value)),
                    })
                  }
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
                  className={inputCls}
                  disabled={dis}
                  value={s.factorCountMin}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    onChange(
                      v === 0
                        ? { factorCountMin: 0, factorCountMax: 0 }
                        : {
                            factorCountMin: v,
                            factorCountMax: Math.max(v, s.factorCountMax),
                          },
                    );
                  }}
                >
                  <option value={0}>指定なし</option>
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n} value={n}>
                      {n}個
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="素因数の個数（最大）">
                <select
                  className={inputCls}
                  value={s.factorCountMin === 0 ? 0 : s.factorCountMax}
                  disabled={dis || s.factorCountMin === 0}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    onChange(
                      v === 0
                        ? { factorCountMin: 0, factorCountMax: 0 }
                        : { factorCountMax: Math.max(s.factorCountMin, v) },
                    );
                  }}
                >
                  <option value={0}>指定なし</option>
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n} value={n}>
                      {n}個
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <p className="jp text-[11px] leading-relaxed text-slate-400">
              出された合成数に素数を1つずつ入力（Enter）して素因数分解する早解きです。
              「残りが見えない」は式の合計だけが見える難しめ、「割り算」は目標が割れていく易しめの進め方です。
              素因数は「下限素数〜上限素数」の範囲のものだけが現れ、個数は最小〜最大の範囲で毎回変わります。
              下限・上限は2〜997のすべての素数（3桁の素数まで）から選べます。
              桁数と素因数の個数は「指定なし」も選べて、その場合は指定した側の条件に合わせて出題されます。
              組み合わせによっては作れない場合があり（例: 5桁・素因数2個・上限5）、
              そのときは開始時にエラーになるので桁数・下限・上限・個数を見直してください。
            </p>
          </div>
        )}
      </div>

      {/* ===== 対戦形式（個人戦 / チーム戦） ===== */}
      <div className="border border-white/10 bg-black/25 p-3">
        <div className="label jp mb-2 tracking-[.18em] text-cyan-200/70">対戦形式</div>
        <div className="flex flex-wrap gap-2">
          <Chip
            disabled={dis}
            active={s.battleMode === 'solo'}
            onClick={() => onChange({ battleMode: 'solo' })}
          >
            個人戦
          </Chip>
          <Chip
            disabled={dis}
            active={s.battleMode === 'team'}
            onClick={() => onChange({ battleMode: 'team' })}
          >
            チーム戦
          </Chip>
        </div>

        {s.battleMode === 'team' && (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="チーム数（2〜6）">
                <div className="flex flex-wrap gap-1.5">
                  {[2, 3, 4, 5, 6].map((n) => (
                    <Chip
                      key={n}
                      disabled={dis}
                      active={s.teamCount === n}
                      onClick={() => onChange({ teamCount: n })}
                    >
                      {n}
                    </Chip>
                  ))}
                </div>
              </Field>
              <Field label="チーム分け">
                <select
                  className={inputCls}
                  disabled={dis}
                  value={s.teamAssignMode}
                  onChange={(e) => onChange({ teamAssignMode: e.target.value as Settings['teamAssignMode'] })}
                >
                  <option value="balanced">バランス（強さ順に蛇行）</option>
                  <option value="random">ランダム</option>
                  <option value="manual">GMが手動で指定</option>
                </select>
              </Field>
              <Field label="勝利条件">
                <select
                  className={inputCls}
                  disabled={dis}
                  value={s.teamWinCondition}
                  onChange={(e) => onChange({ teamWinCondition: e.target.value as Settings['teamWinCondition'] })}
                >
                  <option value="totalScore">合計点数で勝負</option>
                  <option value="firstPlaceCount">1位獲得数で勝負</option>
                  <option value="correctCount">正解数で勝負</option>
                  <option value="averageScore">平均点で勝負（人数差に強い）</option>
                </select>
              </Field>
            </div>
            <p className="jp text-[11px] leading-relaxed text-slate-400">
              チーム数は2〜6（3チーム以上の対戦も可能）。全チームに最低1人ずつ入るよう、
              参加人数がチーム数に満たないときは開始できません。各チームの人数差は自動分けで最大1になります。
              <br />
              {s.teamAssignMode === 'balanced' &&
                'チーム分け「バランス」：直前のスコアが高い順に並べ、A→B→…→B→A と蛇行させて振り分けるので実力が偏りません（初回は参加順）。'}
              {s.teamAssignMode === 'random' &&
                'チーム分け「ランダム」：シャッフルして均等に振り分けます。ロビーで振り分け直すこともできます。'}
              {s.teamAssignMode === 'manual' &&
                'チーム分け「手動」：ロビーでGMが各プレイヤーの所属を選べます。未指定の人は開始時に人数の少ないチームへ入ります。'}
              <br />
              {s.teamWinCondition === 'totalScore' &&
                '勝利条件はメンバー全員の合計点です。個人の配点はいつも通り順位ごとに付きます。'}
              {s.teamWinCondition === 'firstPlaceCount' &&
                '勝利条件は「そのチームのメンバーが1位を取った回数」です。合計点は同点時の参考表示のみ。'}
              {s.teamWinCondition === 'correctCount' &&
                '勝利条件はメンバー全員の正解数の合計です（入賞枠に入った解答が対象）。'}
              {s.teamWinCondition === 'averageScore' &&
                '勝利条件はメンバー1人あたりの平均点です。チームの人数がそろっていなくても公平に競えます。'}
              {' '}選んだ勝利条件の値が同点なら引き分けです。
            </p>
          </div>
        )}
      </div>

      {s.gameMode === 'make10' && (
      <>
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
      </div>

      <div>
                <div className="label jp mb-2 tracking-[.18em] text-cyan-200/70">使用可能な演算子</div>
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

      </>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {s.gameMode === 'make10' && (
          <Toggle
            label="出題数字の重複を許可"
            disabled={dis}
            checked={s.allowDuplicateNumbers}
            onChange={(v) => onChange({ allowDuplicateNumbers: v })}
          />
        )}
        {s.gameMode === 'make10' && (
          <Toggle
            label="途中結果を整数のみに制限"
            disabled={dis}
            checked={s.integerOnly}
            onChange={(v) => onChange({ integerOnly: v })}
          />
        )}
        <Toggle
          label="制限時間なし（全員パスで次へ）"
          disabled={dis}
          checked={s.unlimitedTime}
          onChange={(v) => onChange({ unlimitedTime: v })}
        />
        <Toggle
          label="結果のあと自動で次の問題へ（10秒後）"
          disabled={dis}
          checked={s.autoNextRound}
          onChange={(v) => onChange({ autoNextRound: v })}
        />
        <Toggle
          label={s.gameMode === 'factor' ? '素因数の個数を問題に表示' : '解の通り数を問題に表示'}
          disabled={dis}
          checked={s.showDifficulty}
          onChange={(v) => onChange({ showDifficulty: v })}
        />
        <Toggle
          label="結果発表まで正解状況・順位を隠す"
          disabled={dis}
          checked={s.hideLiveAnswers}
          onChange={(v) => onChange({ hideLiveAnswers: v })}
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
              max={3600}
              value={s.timeLimitSec}
              onChange={(e) => onChange({ timeLimitSec: Number(e.target.value) })}
            />
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
            <option value="custom">順位ごとに配点を設定</option>
          </select>
        </Field>
        {s.scoringMode !== 'first' && (
          <Field label="何位まで点数をつけるか">
            <input
              type="number"
              className={inputCls}
              disabled={dis}
              min={1}
              max={50}
              value={s.maxRankCount}
              onChange={(e) => onChange({ maxRankCount: Math.min(50, Math.max(1, Math.floor(Number(e.target.value) || 1))) })}
            />
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
      {s.scoringMode === 'custom' && (
        <div>
          <div className="label jp mb-2 tracking-[.18em] text-cyan-200/70">順位ごとの配点</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Array.from({ length: s.maxRankCount }, (_, i) => (
              <Field key={i} label={`${i + 1}位（点）`}>
                <input
                  type="number" className={inputCls} disabled={dis} min={0} max={9999}
                  value={s.customRankPoints[i] ?? 0}
                  onChange={(e) => {
                    const points = Array.from({ length: s.maxRankCount }, (_, rank) => s.customRankPoints[rank] ?? 0);
                    points[i] = Math.min(9999, Math.max(0, Math.floor(Number(e.target.value) || 0)));
                    onChange({ customRankPoints: points });
                  }}
                />
              </Field>
            ))}
          </div>
        </div>
      )}
      <p className="jp text-[11px] leading-relaxed text-slate-400">
        {s.hideLiveAnswers
          ? '結果発表まで他の人の正解・パス状況と順位を非表示にします。得点枠が埋まるか、未正解者が全員パスするか、時間切れになると終了します。'
          : '得点枠が埋まるか、未正解者が全員パスすると終了します。'}
      </p>
      {dis && (
        <p className="jp text-[11px] leading-relaxed text-slate-500">
          設定を変更できるのはゲームマスター（ルーム作成者）だけです。
        </p>
      )}
    </div>
  );
}
