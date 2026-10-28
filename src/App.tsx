import { useEffect, useRef, useState } from 'react';
import { useRoom } from './lib/useRoom';
import { TopScreen } from './components/TopScreen';
import { Lobby } from './components/Lobby';
import { GameScreen } from './components/GameScreen';
import { FinalResult } from './components/FinalResult';
import { SoloScreen } from './components/SoloScreen';
import { RoomHealthNotice } from './components/RoomHealthNotice';
import { ChatOverlay } from './components/ChatOverlay';
import { ChatDock } from './components/ChatDock';
import { AudioControls } from './components/AudioControls';
import { Spinner } from './components/ui';
import { playSe, resumeBgmIfNeeded, setBgm, unlockAudio } from './lib/audio';

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

  // ===== オーディオ =====
  // ブラウザの自動再生制限があるので、最初の操作で解放する
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true, passive: true });
    const onVisible = () => {
      if (document.visibilityState === 'visible') resumeBgmIfNeeded();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // 画面に合わせて BGM を切り替える
  const status = room?.status ?? null;
  useEffect(() => {
    if (solo) {
      setBgm('battle');
    } else if (!roomId || !status || status === 'lobby') {
      setBgm('menu');
    } else if (status === 'finished') {
      setBgm('result');
    } else {
      setBgm('battle');
    }
  }, [solo, roomId, status]);

  // 入退室の効果音（自分の画面だけ）
  const knownUidsRef = useRef<Set<string> | null>(null);
  const playerUids = (ctrl.players ?? []).map((p) => p.uid).join(',');
  useEffect(() => {
    const uids = playerUids ? playerUids.split(',') : [];
    if (knownUidsRef.current === null) {
      knownUidsRef.current = new Set(uids);
      return;
    }
    const known = knownUidsRef.current;
    let joined = false;
    let left = false;
    for (const u of uids) {
      if (!known.has(u)) {
        known.add(u);
        joined = true;
      }
    }
    for (const u of [...known]) {
      if (!uids.includes(u)) {
        known.delete(u);
        left = true;
      }
    }
    if (joined) playSe('join');
    else if (left) playSe('leave');
  }, [playerUids]);

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
        onPeek={(code) => ctrl.peekRoom(code)}
        onJoin={(code, name, teamId) => ctrl.joinRoom(code, name, teamId)}
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
    <div className="bg-scene min-h-screen text-[#dbe9ff]">
      {/* 背景装飾より前面に出す（z-index は .bg-scene の stacking context 内で解決） */}
      <div className="relative z-[1]">{content}</div>

      {!solo && room && <ChatOverlay ctrl={ctrl} />}
      {!solo && room && <ChatDock ctrl={ctrl} />}
      {!solo && <RoomHealthNotice ctrl={ctrl} />}
      {/* 画面（トップ / 練習 / ロビー / 対戦 / 結果）が変わったら AUDIO パネルを閉じる */}
      <AudioControls
        screenKey={solo ? 'solo' : roomId && room ? `${roomId}:${room.status}` : 'top'}
      />

      {showPreparing && (
        <div className="animate-fade-in fixed inset-0 z-[96] grid place-items-center bg-black/85 p-6 backdrop-blur-md">
          <div className="card hud-corner w-full max-w-sm p-6 text-center">
            <div className="scan-line" />
            <Spinner className="mx-auto h-8 w-8 border-[3px]" />
            <div className="label mt-4 text-cyan-200">GENERATING</div>
            <div className="jp mt-1 text-base font-black text-white">問題を準備中…</div>
            <p className="jp mt-1 text-[11px] leading-relaxed text-slate-400">
              GMが「必ず解ける問題」を探索しています。
              <br />
              重い設定だと数秒かかることがあります。
            </p>
            <div className="num mt-3 flex items-center justify-center gap-3 text-[10px] tabular-nums text-slate-500">
              <span>{(preparingElapsed / 1000).toFixed(1)}s</span>
              {ctrl.isGM && ctrl.genProgress && <span>{ctrl.genProgress.attempts} TRIALS</span>}
            </div>
            {ctrl.isGM && (
              <p className="jp mt-2 text-[10px] leading-relaxed text-slate-500">
                最大3秒で打ち切り。ダメなら設定の見直しを（画面は固まりません）
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
