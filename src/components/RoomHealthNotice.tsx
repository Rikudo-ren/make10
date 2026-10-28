import { useEffect, useState } from 'react';
import type { UseRoom } from '../lib/useRoom';
import { Button, Icon } from './ui';

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
    <div className="animate-rise fixed inset-x-0 top-3 z-[65] mx-auto flex w-[94%] max-w-lg flex-col gap-2.5 border-l-2 border-brass bg-[#161208]/95 px-4 py-3 shadow-2xl sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-2.5">
        <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-brass" />
        <div className="min-w-0">
          <div className="text-[12.5px] font-semibold text-[#efd894]">
            GM（ルーム作成者）との接続が切れました
          </div>
          <div className="mt-0.5 text-[11px] leading-relaxed text-bone-dim">
            このままでは次の問題を出題できません。退出して新しいルームを作成してください。
          </div>
        </div>
      </div>
      <Button variant="amber" className="shrink-0 px-3 py-2 text-[10px]" onClick={() => ctrl.leaveRoom()}>
        退出する
      </Button>
    </div>
  );
}
