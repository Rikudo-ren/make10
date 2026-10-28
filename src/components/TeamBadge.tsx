import { teamDef } from '../lib/teams';
import { cn } from '../utils/cn';

/** チーム所属を示す小さなバッジ。未所属なら何も出さない */
export function TeamBadge({
  teamId,
  size = 'md',
  className,
}: {
  teamId?: number | null;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const def = teamDef(teamId);
  if (!def) return null;
  return (
    <span
      className={cn(
        'jp inline-flex shrink-0 items-center gap-1 font-black whitespace-nowrap',
        size === 'sm' ? 'px-1 py-px text-[8px]' : 'px-1.5 py-0.5 text-[9px]',
        className,
      )}
      style={{
        color: def.color,
        border: `1px solid ${def.color}66`,
        background: `${def.color}1f`,
        textShadow: `0 0 8px ${def.color}66`,
      }}
      title={def.label}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: def.color, boxShadow: `0 0 6px ${def.color}` }}
      />
      {def.label}
    </span>
  );
}

/** チームの色ドットだけ（プレイヤー行の先頭など狭い場所用） */
export function TeamDot({ teamId }: { teamId?: number | null }) {
  const def = teamDef(teamId);
  if (!def) return null;
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ background: def.color, boxShadow: `0 0 7px ${def.color}` }}
      title={def.label}
      aria-label={def.label}
    />
  );
}
