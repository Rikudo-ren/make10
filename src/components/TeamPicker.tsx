import { TEAM_DEFS } from '../lib/teams';
import { cn } from '../utils/cn';

export interface TeamPickerTeam {
  teamId: number;
  members: { name: string; score?: number }[];
}

/**
 * 参加するチームを選ぶための一覧。
 * チーム名だけでなく「今いるメンバー全員」を見てから選べるようにする。
 */
export function TeamPicker({
  teams,
  selected,
  onSelect,
  showScores = false,
  disabled = false,
}: {
  teams: TeamPickerTeam[];
  selected: number | null;
  onSelect: (teamId: number) => void;
  showScores?: boolean;
  disabled?: boolean;
}) {
  const minCount = teams.length > 0 ? Math.min(...teams.map((t) => t.members.length)) : 0;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {teams.map((t) => {
        const def = TEAM_DEFS[t.teamId];
        if (!def) return null;
        const active = selected === t.teamId;
        const fewest = t.members.length === minCount;
        return (
          <button
            key={t.teamId}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(t.teamId)}
            aria-pressed={active}
            className={cn(
              'jp border p-3 text-left transition disabled:opacity-40',
              active
                ? 'bg-white/10 ring-1 ring-white/60'
                : 'bg-black/30 hover:bg-white/[0.06]',
            )}
            style={{ borderColor: `${def.color}${active ? 'cc' : '55'}` }}
          >
            <span className="flex flex-wrap items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: def.color, boxShadow: `0 0 8px ${def.color}` }}
              />
              <span className="text-[14px] font-black" style={{ color: def.color }}>
                {def.label}
              </span>
              <span className="num text-[11px] text-slate-400">{t.members.length}人</span>
              {fewest && (
                <span className="border border-white/20 bg-white/5 px-1.5 py-px text-[8px] font-bold text-slate-300">
                  人数少なめ
                </span>
              )}
              {active && (
                <span className="ml-auto text-[9px] font-black tracking-wider text-white">選択中</span>
              )}
            </span>
            <span className="mt-2 block text-[11px] leading-relaxed text-slate-300">
              {t.members.length > 0 ? (
                t.members.map((m, i) => (
                  <span key={`${m.name}-${i}`}>
                    {i > 0 && <span className="text-slate-600"> / </span>}
                    <span className="font-bold break-words" style={{ overflowWrap: 'anywhere' }}>
                      {m.name}
                    </span>
                    {showScores && typeof m.score === 'number' && (
                      <span className="num text-slate-500"> {m.score}点</span>
                    )}
                  </span>
                ))
              ) : (
                <span className="text-slate-500">（まだメンバーがいません）</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
