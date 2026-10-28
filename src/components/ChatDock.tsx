import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { UseRoom } from '../lib/useRoom';
import { CHAT_KEEP, CHAT_MAX_LEN } from '../lib/useRoom';
import { IconClose, IconComms, IconSend } from './icons';
import { cn } from '../utils/cn';
import { playSe } from '../lib/audio';

const QUICK = ['ナイス', 'gg', 'まって', 'いける'];

export interface ChatEntry {
  id: string;
  uid: string;
  name: string;
  text: string;
  at: number;
}

export function useChatMessages(ctrl: UseRoom): ChatEntry[] {
  const raw = ctrl.room?.chat;
  return useMemo(() => {
    const src = raw ?? {};
    return Object.entries(src)
      .filter(([, m]) => m && typeof m.text === 'string' && m.text.length > 0)
      .map(([id, m]) => ({ id, uid: m.uid, name: m.name, text: m.text, at: m.at }))
      .sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
  }, [raw]);
}

function formatTime(at: number) {
  if (!at || !Number.isFinite(at)) return '--:--';
  try {
    return new Date(at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
}

function hueOf(uid: string) {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) % 360;
  return h;
}

/** 送信フォーム（対戦中は画面下の1行バーとしても使う） */
export function ChatComposer({ ctrl, compact }: { ctrl: UseRoom; compact?: boolean }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const send = async (value: string) => {
    const v = value.trim();
    if (!v || sending) return;
    setSending(true);
    const ok = await ctrl.sendChat(v);
    setSending(false);
    if (ok) {
      setText('');
      setNotice(null);
    } else {
      setNotice('送信できませんでした（連投は少し待ってください）');
      window.setTimeout(() => setNotice(null), 2200);
    }
  };

  return (
    <div>
      <form
        className="flex items-stretch gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <input
          className={cn('input min-w-0 flex-1', compact ? 'py-1.5 text-[12px]' : 'py-2 text-[13px]')}
          placeholder="コメントを送信…"
          maxLength={CHAT_MAX_LEN}
          autoComplete="off"
          enterKeyHint="send"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="チャットメッセージ"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          aria-label="送信"
          className="grid w-11 shrink-0 place-items-center border border-cyan-300/60 bg-cyan-400/20 text-cyan-100 transition hover:bg-cyan-300/35 hover:text-white disabled:opacity-30"
          style={{
            clipPath: 'polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%)',
          }}
        >
          <IconSend size={16} />
        </button>
      </form>
      {notice ? (
        <p className="mt-1 text-[10px] text-rose-300">{notice}</p>
      ) : (
        !compact && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void send(q)}
                disabled={sending}
                className="jp border border-white/12 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-slate-300 transition hover:border-cyan-300/50 hover:text-cyan-100 disabled:opacity-40"
                style={{
                  clipPath:
                    'polygon(5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%,0 5px)',
                }}
              >
                {q}
              </button>
            ))}
          </div>
        )
      )}
    </div>
  );
}

/** ログ本体（ドロワー内で使う） */
function ChatLog({
  messages,
  myUid,
  isGM,
  onClear,
}: {
  messages: ChatEntry[];
  myUid: string | null;
  isGM: boolean;
  onClear: () => void;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const lastId = messages.length > 0 ? messages[messages.length - 1].id : '';
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId]);

  return (
    <div
      ref={listRef}
      className="h-full min-h-0 flex-1 overflow-y-auto border border-white/8 bg-black/45 p-2.5"
    >
      {messages.length === 0 ? (
        <div className="grid h-full place-items-center px-4 text-center">
          <div>
            <div className="label mb-1 text-cyan-200/40">NO SIGNAL</div>
            <p className="jp text-[11px] leading-relaxed text-slate-500">
              まだコメントはありません。
              <br />
              送信すると全員の画面に流れます。
            </p>
          </div>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {messages.map((m) => {
            const mine = m.uid === myUid;
            const hue = hueOf(m.uid || m.id);
            return (
              <li
                key={m.id}
                className={cn(
                  'border-l px-2 py-[3px] transition',
                  mine ? 'border-cyan-300/80 bg-cyan-400/8' : 'border-white/15 bg-white/[0.03]',
                )}
              >
                <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                  <span className="num shrink-0 text-[9px] text-slate-500">{formatTime(m.at)}</span>
                  {/* 名前は切らない: truncate / max-width を付けず、長い名前は折り返して全文出す */}
                  <span
                    className="min-w-0 text-[10px] font-bold tracking-wider break-words"
                    style={{ color: mine ? '#7ef4ff' : `hsl(${hue} 100% 74%)`, overflowWrap: 'anywhere' }}
                  >
                    {m.name || 'PLAYER'}
                  </span>
                  {mine && (
                    <span className="shrink-0 text-[8px] font-bold tracking-wider text-cyan-300/70">YOU</span>
                  )}
                </div>
                <div className="jp mt-0.5 text-[12.5px] leading-snug break-words whitespace-pre-wrap text-slate-100">
                  {m.text}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {isGM && messages.length > 0 && (
        <div className="mt-2 flex justify-end">
          <button
            onClick={onClear}
            className="text-[9px] font-bold tracking-wider text-slate-500 transition hover:text-rose-300"
            title="チャットの履歴を削除します（GMのみ）"
          >
            CLEAR LOG
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * チャットのログボタン（画面左下）＋ドロワー。
 * オーバーレイで流れたコメントを、いつでも開いて読み返せる。
 */
export function ChatDock({ ctrl }: { ctrl: UseRoom }) {
  const { uid, isGM, room } = ctrl;
  const [open, setOpen] = useState(false);
  const messages = useChatMessages(ctrl);
  const [seenCount, setSeenCount] = useState(0);
  const lastRoomRef = useRef<string | null>(null);

  // ルームが変わったら既存ログは既読扱い（未読バッジを付けない）
  useEffect(() => {
    if (lastRoomRef.current === ctrl.roomId) return;
    lastRoomRef.current = ctrl.roomId;
    setSeenCount(messages.length);
  }, [ctrl.roomId, messages.length]);

  // 開いている間は常に既読扱い
  useEffect(() => {
    if (open) setSeenCount(messages.length);
  }, [open, messages.length]);

  useEffect(() => {
    if (!room) setOpen(false);
  }, [room]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const unread = Math.max(0, messages.length - seenCount);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          playSe('ui');
          setOpen((v) => !v);
        }}
        aria-label="チャットログを開く"
        aria-expanded={open}
        className={cn(
          'fixed bottom-3 left-3 z-[94] grid h-12 w-12 place-items-center border transition-all print:hidden',
          open
            ? 'border-cyan-300/80 bg-cyan-400/25 text-white shadow-[0_0_26px_-8px_rgba(34,224,255,.9)]'
            : 'border-cyan-300/40 bg-black/60 text-cyan-200 hover:bg-cyan-400/15',
        )}
        style={{ clipPath: 'polygon(22% 0,100% 0,100% 78%,78% 100%,0 100%,0 22%)' }}
      >
        <IconComms size={19} />
        {unread > 0 && (
          <span className="num absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-fuchsia-500 px-1 text-[9px] font-black text-white shadow-[0_0_12px_rgba(255,62,200,.9)]">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[93] bg-black/55 backdrop-blur-[2px]" onClick={() => setOpen(false)}>
            <div
              className="card animate-float-up absolute bottom-16 left-3 flex h-[min(70vh,520px)] w-[calc(100%-24px)] max-w-[380px] flex-col p-4"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label="チャットログ"
            >
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <div className="label flex items-center gap-2 text-cyan-100/85">
                  <IconComms size={13} />
                  COMMS LOG
                </div>
                <div className="flex items-center gap-2">
                  <span className="num text-[10px] text-cyan-200/50">
                    {String(messages.length).padStart(2, '0')}
                  </span>
                  <button
                    onClick={() => {
                      playSe('ui');
                      setOpen(false);
                    }}
                    className="text-slate-500 transition hover:text-cyan-200"
                    aria-label="閉じる"
                  >
                    <IconClose size={15} />
                  </button>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                <ChatLog
                  messages={messages}
                  myUid={uid}
                  isGM={isGM}
                  onClear={() => ctrl.clearChat()}
                />
              </div>

              <div className="mt-2.5">
                <ChatComposer ctrl={ctrl} />
              </div>

              <p className="jp mt-1.5 text-[9px] leading-relaxed text-slate-500">
                直近{CHAT_KEEP}件のみ保存／ルームは24時間で自動削除
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
