import { useState } from 'react';
import { useRoom } from './lib/useRoom';
import { TopScreen } from './components/TopScreen';
import { Lobby } from './components/Lobby';
import { GameScreen } from './components/GameScreen';
import { FinalResult } from './components/FinalResult';
import { SoloScreen } from './components/SoloScreen';

export default function App() {
  const ctrl = useRoom();
  const [solo, setSolo] = useState(false);
  const { room, roomId } = ctrl;

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

  return <div className="bg-scene min-h-screen text-slate-100">{content}</div>;
}
