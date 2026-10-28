import { useEffect, useMemo, useRef, useState } from 'react';
import type { UseRoom } from '../lib/useRoom';
import { CHAT_KEEP, CHAT_MAX_LEN } from '../lib/useRoom';
import { Card, SectionTitle, inputCls } from './ui';
import { cn } from '../utils/cn';

const QUICK = ['👍', '😂', '😭', 'ナイス'];

function formatTime(at: number) {
  if (!at || !Number.isFinite(at)) return '';
  try {
    return new Date(at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/**
 * ゲーム内チャット。
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
      setNotice('送信できませんでした（連投は少し待ってね）');
      window.setTimeout(() => setNotice(null), 2000);
    }
  };

  return (
    <Card className={cn('flex flex-col', className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <SectionTitle icon="💬">チャット</SectionTitle>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-500">{messages.length}件</span>
          {isGM && messages.length > 0 && (
            <button
              onClick={() => ctrl.clearChat()}
              className="rounded-lg px-2 py-1 text-[10px] font-bold text-slate-500 transition hover:bg-white/8 hover:text-rose-300"
              title="チャットの履歴を削除します（GMのみ）"
            >
              履歴を消す
            </button>
          )}
        </div>
      </div>

      <div
        ref={listRef}
        className="h-44 space-y-2 overflow-y-auto rounded-2xl border border-white/8 bg-black/25 p-2.5 sm:h-52"
      >
        {messages.length === 0 ? (
          <p className="grid h-full place-items-center px-4 text-center text-[11px] leading-relaxed text-slate-500">
            まだチャットはありません。
            <br />
            あいさつや作戦を送ってみよう
          </p>
        ) : (
          <ul className="space-y-2">
            {messages.map((m) => {
              const mine = m.uid === uid;
              return (
                <li key={m.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
                  <div className="flex items-baseline gap-1.5 px-1 text-[10px] text-slate-500">
                    <span className={cn('font-bold', mine ? 'text-indigo-300' : 'text-slate-400')}>
                      {mine ? 'あなた' : m.name || 'プレイヤー'}
                    </span>
                    <span className="tabular-nums">{formatTime(m.at)}</span>
                  </div>
                  <div
                    className={cn(
                      'mt-0.5 max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm leading-snug',
                      mine
                        ? 'bg-indigo-500/30 text-indigo-50'
                        : 'bg-white/8 text-slate-100',
                    )}
                  >
                    {m.text}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => send(q)}
            disabled={sending}
            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-slate-300 transition hover:bg-white/12 disabled:opacity-40"
          >
            {q}
          </button>
        ))}
      </div>

      <form
        className="mt-2 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <input
          className={cn(inputCls, 'min-w-0 flex-1 py-2 text-sm')}
          placeholder="メッセージを送る"
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
          className="shrink-0 rounded-xl bg-indigo-500 px-3 py-2 text-sm font-black text-white transition hover:bg-indigo-400 disabled:opacity-40"
        >
          送信
        </button>
      </form>

      <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
        {notice ?? `直近${CHAT_KEEP}件のみ保存（GMが退出するとルームごと削除）`}
      </p>
    </Card>
  );
}
