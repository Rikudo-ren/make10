import { useEffect, useRef, useState } from 'react';
import type { UseRoom } from '../lib/useRoom';
import { playSe } from '../lib/audio';

interface FloatItem {
  key: string;
  name: string;
  text: string;
  mine: boolean;
  hue: number;
}

const LIFETIME_MS = 6200;
const MAX_STACK = 2;

function hueOf(uid: string) {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) % 360;
  return h;
}

/**
 * ゴッドフィールド風のコメント表示。
 * チャットが送られると、全員の画面の下から「名前＋コメント」が大きく流れて上がる。
 * （ログは ChatPanel 側に残るので、見逃しても後から確認できる）
 */
export function ChatOverlay({ ctrl }: { ctrl: UseRoom }) {
  const { room, uid } = ctrl;
  const [items, setItems] = useState<FloatItem[]>([]);
  const seenRef = useRef<Set<string> | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const chat = room?.chat ?? {};
    const entries = Object.entries(chat)
      .filter(([, m]) => m && typeof m.text === 'string' && m.text.length > 0)
      .sort((a, b) => (a[1].at ?? 0) - (b[1].at ?? 0));

    // 入室した瞬间に過去ログを全部流さない（初回は既読扱い）
    if (seenRef.current === null) {
      seenRef.current = new Set(entries.map(([id]) => id));
      return;
    }
    const seen = seenRef.current;
    const fresh = entries.filter(([id]) => !seen.has(id));
    if (fresh.length === 0) return;
    for (const [id] of fresh) seen.add(id);

    const added: FloatItem[] = fresh.slice(-MAX_STACK).map(([id, m]) => ({
      key: id,
      name: (m.name || 'PLAYER').slice(0, 20),
      text: m.text,
      mine: m.uid === uid,
      hue: hueOf(m.uid || id),
    }));

    setItems((prev) => [...prev, ...added].slice(-MAX_STACK));

    const mine = added.some((a) => a.mine);
    playSe(mine ? 'chatSend' : 'chatRecv');

    for (const item of added) {
      const t = setTimeout(() => {
        setItems((prev) => prev.filter((p) => p.key !== item.key));
      }, LIFETIME_MS);
      timersRef.current.push(t);
    }
  }, [room?.chat, uid]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[14vh] z-[25] flex flex-col items-center gap-2 px-4">
      {items.map((it) => (
        <div
          key={it.key}
          className="flex w-full max-w-2xl justify-center"
          style={{ animation: `chat-rise ${LIFETIME_MS}ms cubic-bezier(.16,.84,.3,1) forwards` }}
        >
          <div className="relative max-w-full">
            {/* 背景の斜めプレート */}
            <div
              className="absolute inset-0 border border-white/15"
              style={{
                clipPath: 'polygon(16px 0,100% 0,calc(100% - 16px) 100%,0 100%)',
                background:
                  'linear-gradient(90deg, rgba(4,8,14,.92) 0%, rgba(6,14,24,.82) 60%, rgba(4,8,14,.55) 100%)',
                boxShadow: `0 0 40px -18px hsla(${it.hue},100%,65%,.9)`,
              }}
            />
            <div
              className="absolute top-0 left-0 h-full w-[3px]"
              style={{ background: `hsl(${it.hue} 100% 65%)`, boxShadow: `0 0 16px hsl(${it.hue} 100% 65%)` }}
            />
            <div
              className="absolute bottom-0 left-0 h-[1px] w-full origin-left bg-current opacity-60"
              style={{
                color: `hsl(${it.hue} 100% 70%)`,
                animation: `chat-bar ${LIFETIME_MS}ms linear forwards`,
              }}
            />
            <div className="relative flex items-baseline gap-3 px-5 py-2.5">
              <span
                className="font-term max-w-[38%] shrink-0 truncate text-[13px] font-bold tracking-[.2em] sm:text-sm"
                style={{
                  color: it.mine ? '#7ef4ff' : `hsl(${it.hue} 100% 78%)`,
                  textShadow: `0 0 14px hsla(${it.hue},100%,65%,.8)`,
                }}
              >
                {it.name}
                {it.mine && <span className="ml-1.5 text-[9px] text-cyan-300/70">YOU</span>}
              </span>
              <span
                className="jp min-w-0 break-words text-[19px] leading-tight font-black text-white sm:text-[26px]"
                style={{ textShadow: '0 2px 18px rgba(0,0,0,.95), 0 0 24px rgba(120,220,255,.35)' }}
              >
                {it.text}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
