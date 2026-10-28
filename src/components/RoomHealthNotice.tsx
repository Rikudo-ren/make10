import { useEffect, useState } from 'react';
import type { UseRoom } from '../lib/useRoom';
import { Button } from './ui';

/** GMが切断してから通知を出すまでの猶予（瞬間的な再接続でちらつかせない） */
const GM_MISSING_DELAY_MS = 8000;

/**
 * 「GMがいない部屋」の通知。
 * 参加者が残ったままだと誰も次の問題を出せず詰むので、退出を促す。
 * （在室者が0人になれば、ルーム自体は自動で削除される）
 */
export function RoomHealthNotice({ ctrl }: { ctrl: UseRoom }) {
  const { room, players, uid, isGM } = ctrl;
  const [visible, setVisible] = useState(false);

  const gmPresent = !room || !room.gmUid || players.some((p) => p.uid === room.gmUid);
  const shouldWarn = !!room && !!uid && !isGM && players.length > 0 && !gmPresent;

  useEffect(() => {
    if (!shouldWarn) {
      setVisible(false);
      return;
    }
    const id = setTimeout(() => setVisible(true), GM_MISSING_DELAY_MS);
    return () => clearTimeout(id);
  }, [shouldWarn]);

  if (!visible || !shouldWarn) return null;

  return (
    <div className="animate-float-up fixed inset-x-0 top-3 z-[65] mx-auto flex w-[94%] max-w-lg flex-col gap-2 rounded-2xl border border-amber-400/40 bg-amber-950/95 px-4 py-3 text-amber-50 shadow-2xl sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 text-xs font-bold leading-relaxed">
        <div className="text-sm font-black text-amber-200">⚠ GM（ルーム作成者）が切断されました</div>
        <div className="mt-0.5 text-[11px] text-amber-100/80">
          このままでは次の問題を出題できません。退出して新しいルームを作ってください。
        </div>
      </div>
      <Button
        variant="amber"
        className="shrink-0 px-3 py-2 text-xs"
        onClick={() => ctrl.leaveRoom()}
      >
        退出する
      </Button>
    </div>
  );
}
