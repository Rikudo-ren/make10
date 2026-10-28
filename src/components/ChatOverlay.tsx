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

/** 1件が「下から上へゆっくり流れて消える」までの時間 */
const LIFETIME_MS = 9000;
/** 同時に画面へ流す最大件数（ゴッドフィールドのように何行か重なって流れる） */
const MAX_STACK = 6;

function hueOf(uid: string) {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) % 360;
  return h;
}

/**
 * ゴッドフィールド風のコメント表示。
 *
 * - 画面に出るのは「名前：コメント」の文字だけ。プレート・枠・背景などの
 *   ウィジェットは一切描かない（読みやすさは文字の縁取り＝text-shadow で確保する）。
 * - 名前は省略しない（truncate / max-width で切らない。長い場合は折り返す）。
 * - 当たり判定は一切持たない。ルートに pointer-events-none を付け、さらに
 *   CSS の `.chat-float, .chat-float * { pointer-events: none !important }` で
 *   子要素まで含めて保証する。後ろのタイルやボタンはそのまま押せる。
 * - 新しいコメントは下に現れ、古いものと一緒にゆっくり上へ流れて消える。
 *   見逃してもログ（COMMS ボタン）から読み返せる。
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

    // 入室した瞬間に過去ログを全部流さない（初回は既読扱い）
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
      // DB上限（20文字）まではそのまま出す。CSS側でも一切切らない
      name: m.name || 'PLAYER',
      text: m.text,
      mine: m.uid === uid,
      hue: hueOf(m.uid || id),
    }));

    setItems((prev) => [...prev, ...added].slice(-MAX_STACK));
    playSe(added.some((a) => a.mine) ? 'chatSend' : 'chatRecv');

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
    <div
      aria-hidden="true"
      className="chat-float pointer-events-none fixed inset-x-0 bottom-[9vh] z-[25] flex flex-col items-start gap-1 px-3 select-none sm:px-5"
      style={{ pointerEvents: 'none' }}
    >
      {items.map((it) => (
        <p
          key={it.key}
          className="jp pointer-events-none max-w-full text-[17px] leading-snug font-black break-words sm:text-[22px]"
          style={{
            pointerEvents: 'none',
            overflowWrap: 'anywhere',
            animation: `chat-drift ${LIFETIME_MS}ms linear forwards`,
            // 背景パネルなしでもゲーム画面の上で読めるよう、文字自体に濃い縁取りを付ける
            textShadow:
              '0 0 3px rgba(0,0,0,.95), 0 1px 1px rgba(0,0,0,1), 1px 0 1px rgba(0,0,0,.9), -1px 0 1px rgba(0,0,0,.9), 0 2px 12px rgba(0,0,0,.95)',
          }}
        >
          <span
            className="pointer-events-none"
            style={{
              pointerEvents: 'none',
              color: it.mine ? '#7ef4ff' : `hsl(${it.hue} 100% 78%)`,
            }}
          >
            {it.name}
          </span>
          <span className="pointer-events-none text-white/85" style={{ pointerEvents: 'none' }}>
            ：
          </span>
          <span className="pointer-events-none text-white" style={{ pointerEvents: 'none' }}>
            {it.text}
          </span>
        </p>
      ))}
    </div>
  );
}
