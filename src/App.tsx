import { useEffect, useState } from 'react';
import { useRoom } from './lib/useRoom';
import { TopScreen } from './components/TopScreen';
import { Lobby } from './components/Lobby';
import { GameScreen } from './components/GameScreen';
import { FinalResult } from './components/FinalResult';
import { SoloScreen } from './components/SoloScreen';
import { RoomHealthNotice } from './components/RoomHealthNotice';
import { Icon, Spinner } from './components/ui';

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
    <div className="bg-scene min-h-screen text-bone">
      {content}

      {!solo && <RoomHealthNotice ctrl={ctrl} />}

      {showPreparing && (
        <div className="animate-fade-in fixed inset-0 z-[80] grid place-items-center bg-ink/88 p-6 backdrop-blur-md">
          <div className="card w-full max-w-sm p-6 text-center">
            <div className="flex items-center justify-center gap-2.5">
              <span className="h-1.5 w-1.5 animate-breathe bg-cyber" />
              <span className="eyebrow">Generating</span>
            </div>
            <Spinner className="mx-auto mt-5 h-8 w-8" />
            <div className="display mt-4 text-[20px] text-bone">問題を準備中</div>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-bone-dim">
              GM が「必ず解ける問題」を探しています。
              <br />
              重い設定では数秒かかることがあります。
            </p>
            <div className="numeral mt-4 flex items-center justify-center gap-3 text-[11px] tracking-[0.1em] text-bone-faint">
              <span>{(preparingElapsed / 1000).toFixed(1)} s</span>
              {ctrl.isGM && ctrl.genProgress && (
                <span>{ctrl.genProgress.attempts} attempts</span>
              )}
            </div>
            {ctrl.isGM && (
              <p className="mt-2.5 flex items-start justify-center gap-1.5 text-[10px] leading-relaxed text-bone-faint">
                <Icon name="clock" className="mt-0.5 h-3 w-3 shrink-0" />
                <span>最大3秒で打ち切り。それでも出ない場合は設定をゆるめてください（画面は固まりません）</span>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
