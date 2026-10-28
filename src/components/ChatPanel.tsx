import { useEffect, useMemo, useRef, useState } from 'react';
import type { UseRoom } from '../lib/useRoom';
import { CHAT_KEEP, CHAT_MAX_LEN } from '../lib/useRoom';
import { Card, SectionTitle } from './ui';
import { IconComms, IconSend } from './icons';
import { cn } from '../utils/cn';

const QUICK = ['ナイス', 'gg', 'まって', 'いける'];

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

/**
 * ゲーム内チャット（ログ）。
 * 送信した内容は全員の画面に大きく流れる（ChatOverlay）が、
 * ここにはログとして残るので後からでも全員のコメントを確認できる。
 * メッセージは Firebase Realtime Database の rooms/{code}/chat にのみ保存され、
 * 直近 CHAT_KEEP 件を超えた分は送信時に削除される（GMが退出するとルームごと消える）。
 */
export function ChatPanel({ ctrl, className }: { ctrl: UseRoom; className?: string }) {
  const { room, uid, isGM } = ctrl;
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const messages = useMemo(() => {
    const raw = room?.chat ?? {};
    return Object.entries(raw)
      .filter(([, m]) => m && typeof m.text === 'string' && m.text.length > 0)
      .map(([id, m]) => ({ id, ...m }))
      .sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
  }, [room?.chat]);

  const lastId = messages.length > 0 ? messages[messages.length - 1].id : '';
  // 新着が来たときだけ最下部へスクロール（過去ログを読んでいる邪魔をしない）
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId]);

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
    <Card className={cn('flex flex-col', className)}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <SectionTitle icon={<IconComms size={14} />}>COMMS LOG</SectionTitle>
        <div className="flex items-center gap-2">
          <span className="num text-[10px] text-cyan-200/50">{String(messages.length).padStart(2, '0')}</span>
          {isGM && messages.length > 0 && (
            <button
              onClick={() => ctrl.clearChat()}
              className="text-[10px] font-bold tracking-wider text-slate-500 transition hover:text-rose-300"
              title="チャットの履歴を削除します（GMのみ）"
            >
              CLEAR
            </button>
          )}
        </div>
      </div>

      <div
        ref={listRef}
        className="mask-fade-y h-48 overflow-y-auto border border-white/8 bg-black/45 p-2.5 sm:h-56"
      >
        {messages.length === 0 ? (
          <div className="grid h-full place-items-center px-4 text-center">
            <div>
              <div className="label mb-1 text-cyan-200/40">NO SIGNAL</div>
              <p className="jp text-[11px] leading-relaxed text-slate-500">
                まだコメントはありません。
                <br />
                送信すると全員の画面に大きく流れます。
              </p>
            </div>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {messages.map((m) => {
              const mine = m.uid === uid;
              const hue = hueOf(m.uid || m.id);
              return (
                <li
                  key={m.id}
                  className={cn(
                    'border-l px-2 py-[3px] transition',
                    mine ? 'border-cyan-300/80 bg-cyan-400/8' : 'border-white/15 bg-white/[0.03]',
                  )}
                >
                  <div className="flex items-baseline gap-1.5">
                    <span className="num text-[9px] text-slate-500">{formatTime(m.at)}</span>
                    <span
                      className="max-w-[45%] truncate font-bold text-[10px] tracking-wider"
                      style={{ color: mine ? '#7ef4ff' : `hsl(${hue} 100% 74%)` }}
                    >
                      {mine ? 'YOU' : m.name || 'PLAYER'}
                    </span>
                  </div>
                  <div className="jp mt-0.5 text-[12.5px] leading-snug break-words whitespace-pre-wrap text-slate-100">
                    {m.text}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => send(q)}
            disabled={sending}
            className="jp border border-white/12 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-slate-300 transition hover:border-cyan-300/50 hover:text-cyan-100 disabled:opacity-40"
            style={{
              clipPath: 'polygon(5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%,0 5px)',
            }}
          >
            {q}
          </button>
        ))}
      </div>

      <form
        className="mt-2 flex items-stretch gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <input
          className="input min-w-0 flex-1 py-2 text-[13px]"
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
          style={{ clipPath: 'polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%)' }}
        >
          <IconSend size={16} />
        </button>
      </form>

      <p className="jp mt-1.5 text-[10px] leading-relaxed text-slate-500">
        {notice ?? `ログは直近${CHAT_KEEP}件を保存／ルームは24時間で自動削除`}
      </p>
    </Card>
  );
}
