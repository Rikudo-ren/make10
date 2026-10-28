import { useEffect, useState } from 'react';
import { useRoom } from './lib/useRoom';
import { TopScreen } from './components/TopScreen';
import { Lobby } from './components/Lobby';
import { GameScreen } from './components/GameScreen';
import { FinalResult } from './components/FinalResult';
import { SoloScreen } from './components/SoloScreen';
import { Spinner } from './components/ui';

export default function App() {
  const ctrl = useRoom();
  const [solo, setSolo] = useState(false);
  const { room, roomId } = ctrl;

  // 「問題を準備中」表示の経過時間更新用
  const [, setTick] = useState(0);
  const preparingAt = typeof room?.preparingAt === 'number' ? room.preparingAt : null;
  const preparingElapsed = preparingAt ? Math.max(0, ctrl.serverNow() - preparingAt) : 0;
  // 生成に失敗して preparingAt が残ってしまった場合でも、一定時間で必ず消す
  const showPreparing = preparingAt !== null && preparingElapsed < 20_000;

  useEffect(() => {
    if (!showPreparing) return;
    const id = setInterval(() => setTick((t) => t + 1), 200);
    return () => clearInterval(id);
  }, [showPreparing]);

  let content;
  if (solo) {
    content = <SoloScreen onExit={() => setSolo(false)} />;
  } else if (!roomId || !room) {
    content = (
      <TopScreen
        busy={ctrl.busy}
        error={ctrl.error}
        authError={ctrl.authError}
        onCreate={(name) => ctrl.createRoom(name)}
        onJoin={(code, name) => ctrl.joinRoom(code, name)}
        onSolo={() => setSolo(true)}
      />
    );
  } else if (room.status === 'lobby') {
    content = <Lobby ctrl={ctrl} />;
  } else if (room.status === 'finished') {
    content = <FinalResult ctrl={ctrl} />;
  } else {
    content = <GameScreen ctrl={ctrl} />;
  }

  return (
    <div className="bg-scene min-h-screen text-slate-100">
      {content}

      {showPreparing && (
        <div className="animate-fade-in fixed inset-0 z-[80] grid place-items-center bg-black/80 p-6 backdrop-blur-md">
          <div className="card w-full max-w-sm p-6 text-center">
            <Spinner className="mx-auto h-9 w-9 border-[3px]" />
            <div className="mt-4 text-lg font-black text-white">問題を準備中…</div>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              GMが「必ず解ける問題」を探しています。
              <br />
              重い設定だと数秒かかることがあります。
            </p>
            <div className="mt-4 flex items-center justify-center gap-3 text-[11px] tabular-nums text-slate-500">
              <span>{(preparingElapsed / 1000).toFixed(1)}秒</span>
              {ctrl.isGM && ctrl.genProgress && (
                <span>{ctrl.genProgress.attempts}通り試行</span>
              )}
            </div>
            {ctrl.isGM && (
              <p className="mt-2 text-[10px] text-slate-500">
                最大3秒で打ち切り、ダメなら設定の見直しをお願いします（画面は固まりません）
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
