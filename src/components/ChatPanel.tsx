import { useEffect, useMemo, useRef, useState } from 'react';
import type { UseRoom } from '../lib/useRoom';
import { CHAT_KEEP, CHAT_MAX_LEN } from '../lib/useRoom';
import { Card, Icon, SectionTitle, inputCls } from './ui';
import { cn } from '../utils/cn';

/** 定型文（絵文字は使わない） */
const QUICK = ['よろしく', 'ナイス', 'まいった', 'あと少し'];

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
      setNotice('送信できませんでした（連投は少し待ってください）');
      window.setTimeout(() => setNotice(null), 2000);
    }
  };

  return (
    <Card className={cn('flex flex-col', className)}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <SectionTitle kicker="Transmission">
          <span className="flex items-center gap-1.5">
            <Icon name="chat" className="h-3 w-3 text-bone-faint" />
            チャット
          </span>
        </SectionTitle>
        <div className="flex items-center gap-2">
          <span className="numeral text-[10px] tracking-[0.12em] text-bone-faint">
            {String(messages.length).padStart(2, '0')}
          </span>
          {isGM && messages.length > 0 && (
            <button
              onClick={() => ctrl.clearChat()}
              className="numeral text-[9px] tracking-[0.1em] text-bone-faint transition hover:text-[#ff8a9b]"
              title="チャットの履歴を削除します（GMのみ）"
            >
              履歴を消す
            </button>
          )}
        </div>
      </div>

      <div
        ref={listRef}
        className="scan-surface h-44 space-y-2.5 overflow-y-auto border border-[var(--hair)] bg-black/30 p-2.5 sm:h-52"
      >
        {messages.length === 0 ? (
          <div className="grid h-full place-items-center px-4 text-center">
            <div>
              <Icon name="chat" className="mx-auto h-4 w-4 text-bone-faint/60" />
              <p className="mt-2 text-[11px] leading-relaxed text-bone-faint">
                まだ発言はありません
                <br />
                あいさつや作戦をどうぞ
              </p>
            </div>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {messages.map((m) => {
              const mine = m.uid === uid;
              return (
                <li key={m.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
                  <div className="flex items-baseline gap-1.5 px-0.5">
                    <span
                      className={cn(
                        'numeral text-[9px] tracking-[0.12em]',
                        mine ? 'text-[#ff8a9b]' : 'text-brass/80',
                      )}
                    >
                      {mine ? 'YOU' : m.name || 'PLAYER'}
                    </span>
                    <span className="numeral text-[9px] tabular-nums text-bone-faint/70">
                      {formatTime(m.at)}
                    </span>
                  </div>
                  <div
                    className={cn(
                      'mt-0.5 max-w-[88%] whitespace-pre-wrap break-words border px-2.5 py-1.5 text-[12.5px] leading-snug',
                      mine
                        ? 'border-blood/45 bg-blood/15 text-bone'
                        : 'border-[var(--hair)] bg-white/[0.035] text-bone/90',
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
            className="border border-[var(--hair)] bg-white/[0.02] px-2 py-1 text-[10px] text-bone-dim transition hover:border-brass/50 hover:text-brass disabled:opacity-40"
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
          className={cn(inputCls, 'min-w-0 flex-1 py-2 text-[13px]')}
          placeholder="メッセージ"
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
          className="grid h-9 w-9 shrink-0 place-items-center border border-blood/60 bg-blood/80 text-bone transition hover:bg-blood disabled:opacity-35"
          aria-label="送信"
        >
          <Icon name="send" className="h-3.5 w-3.5" />
        </button>
      </form>

      <p className="mt-1.5 text-[9.5px] leading-relaxed text-bone-faint">
        {notice ?? `直近${CHAT_KEEP}件のみ・ルームは24時間で自動削除`}
      </p>
    </Card>
  );
}
