import { useState } from 'react';
import { useRoom } from './lib/useRoom';
import { useChat } from './lib/useChat';
import { TopScreen } from './components/TopScreen';
import { Lobby } from './components/Lobby';
import { GameScreen } from './components/GameScreen';
import { FinalResult } from './components/FinalResult';
import { SoloScreen } from './components/SoloScreen';
import { ChatWidget } from './components/Chat';

export default function App() {
  const ctrl = useRoom();
  const [solo, setSolo] = useState(false);
  const { room, roomId } = ctrl;

  // チャットはルーム単位。ロビー→対戦→結果まで同じスレッドを使い、
  // 画面が切り替わってもログが消えないよう App 側で購読する。
  const myName = (ctrl.uid && room?.players?.[ctrl.uid]?.name) || 'プレイヤー';
  const chat = useChat(roomId, { uid: ctrl.uid, name: myName });

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
      {!solo && roomId && room && ctrl.uid && <ChatWidget chat={chat} />}
    </div>
  );
}
