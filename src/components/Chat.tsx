import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CHAT_MAX_LEN, type ChatState } from '../lib/useChat';
import { cn } from '../utils/cn';

function timeLabel(at: number | null) {
  if (!at) return '';
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * ゲーム内チャット（全画面で共通のフローティング・ウィジェット）
 *  - スマホ: 右下の 💬 ボタン → 下からシート
 *  - PC: 右下の小パネル
 */
export function ChatWidget({ chat }: { chat: ChatState }) {
  const { messages, meUid, open, unread, error, setOpen, send, clearError } = chat;
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);

  // 新着・オープン時に最下部までスクロール
  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    const ok = await send(text);
    setSending(false);
    if (ok) setDraft('');
  };

  const remain = CHAT_MAX_LEN - draft.length;

  return (
    <>
      {/* 起動ボタン */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="チャットを開く"
          className="fixed bottom-4 right-4 z-20 flex h-12 items-center gap-2 rounded-full border border-indigo-400/40 bg-slate-900/90 px-4 text-sm font-bold text-indigo-100 shadow-[0_14px_34px_-10px_rgba(79,70,229,.8)] backdrop-blur transition hover:border-indigo-300/70 hover:bg-slate-800 active:scale-95 sm:bottom-5 sm:right-5"
        >
          <span className="text-lg leading-none">💬</span>
          <span className="hidden sm:inline">チャット</span>
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white shadow">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      )}

      {/* 背景（スマホのみ） */}
      {open && (
        <div
          className="animate-fade-in fixed inset-0 z-40 bg-black/60 backdrop-blur-sm sm:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* パネル */}
      {open && (
        <div className="animate-float-up fixed inset-x-0 bottom-0 z-50 flex h-[68vh] flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-slate-950/95 shadow-[0_-20px_60px_-20px_rgba(0,0,0,.9)] backdrop-blur-xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[30rem] sm:w-[22rem] sm:rounded-3xl">
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-indigo-500/20 text-sm">
                💬
              </span>
              <div>
                <div className="text-sm font-black tracking-wide text-white">チャット</div>
                <div className="text-[10px] text-slate-400">
                  このルームだけの一時チャット（保存されません）
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="閉じる"
              className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {messages.length === 0 && (
              <div className="mt-6 text-center text-xs leading-relaxed text-slate-500">
                まだメッセージはありません。
                <br />
                気軽にあいさつしてみよう 👋
              </div>
            )}
            {messages.map((m, i) => {
              const mine = !!meUid && m.uid === meUid;
              const prev = messages[i - 1];
              const showName = !mine && (!prev || prev.uid !== m.uid);
              return (
                <div key={m.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
                  {showName && (
                    <span className="mb-0.5 px-1 text-[10px] font-bold text-slate-400">
                      {m.name}
                    </span>
                  )}
                  <div className={cn('flex max-w-[85%] items-end gap-1.5', mine && 'flex-row-reverse')}>
                    <div
                      className={cn(
                        'whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm leading-snug',
                        mine
                          ? 'rounded-br-md bg-gradient-to-br from-indigo-500 to-violet-600 text-white'
                          : 'rounded-bl-md border border-white/10 bg-white/8 text-slate-100',
                      )}
                    >
                      {m.text}
                    </div>
                    <span className="shrink-0 pb-0.5 text-[9px] tabular-nums text-slate-500">
                      {timeLabel(m.at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {error && (
            <button
              type="button"
              onClick={clearError}
              className="mx-3 mb-1 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-left text-[11px] font-bold text-rose-200"
            >
              {error}
            </button>
          )}

          <form
            onSubmit={submit}
            className="flex items-end gap-2 border-t border-white/10 bg-black/20 px-3 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] sm:pb-2.5"
          >
            <div className="flex-1">
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, CHAT_MAX_LEN))}
                onCompositionStart={() => (composingRef.current = true)}
                onCompositionEnd={() => (composingRef.current = false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.nativeEvent.isComposing || composingRef.current)) {
                    e.preventDefault();
                  }
                }}
                maxLength={CHAT_MAX_LEN}
                placeholder="メッセージを入力…"
                enterKeyHint="send"
                className="w-full rounded-xl border border-white/12 bg-black/40 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
            <button
              type="submit"
              disabled={!draft.trim() || sending}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white transition active:scale-95 disabled:opacity-35"
              aria-label="送信"
            >
              ➤
            </button>
          </form>
          {remain <= 20 && (
            <div className="bg-black/20 pb-1 text-center text-[9px] text-slate-500">
              残り {remain} 文字
            </div>
          )}
        </div>
      )}
    </>
  );
}
