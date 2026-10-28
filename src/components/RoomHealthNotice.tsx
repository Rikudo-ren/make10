import { useEffect, useState } from 'react';
import type { UseRoom } from '../lib/useRoom';
import { Button } from './ui';
import { IconAlert } from './icons';

/** GMが切断してから通知を出すまでの猶予（瞬間的な再接続でちらつかせない） */
const GM_MISSING_DELAY_MS = 8000;

/**
 * 「GMがいない部屋」の通知。
 * 参加者が残ったままだと誰も次の問題を出せず詰むので、退出を促す。
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
    <div className="animate-float-up fixed inset-x-0 top-3 z-[88] mx-auto flex w-[94%] max-w-lg flex-col gap-2 border border-amber-400/50 bg-amber-950/95 px-4 py-3 shadow-2xl sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[12px] font-black text-amber-200">
          <IconAlert size={13} />
          GM（ルーム作成者）が切断されました
        </div>
        <div className="jp mt-0.5 text-[10px] leading-relaxed text-amber-100/80">
          このままでは次の問題を出題できません。退出して新しいルームを作ってください。
        </div>
      </div>
      <Button variant="primary" className="shrink-0 px-3 py-2 text-[10px]" onClick={() => ctrl.leaveRoom()}>
        退出する
      </Button>
    </div>
  );
}
