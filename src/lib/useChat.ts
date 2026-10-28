import { useCallback, useEffect, useRef, useState } from 'react';
import { get, onValue, push, ref, remove, serverTimestamp } from 'firebase/database';
import { db } from '../firebase';

/**
 * ゲーム内チャット
 *
 * 保存場所: `chats/{roomCode}/messages/{pushId}`
 *  - ルーム（rooms/...）とは別ノードなので、チャットが部屋データや履歴に混ざらない
 *  - 1ルーム = 1チャンネル。ロビー→対戦→結果まで同じスレッドを使う
 *  - GMが「ロビーに戻る（再戦）」したときに `chats/{roomCode}` ごと削除する
 *  - 自分のメッセージは TTL（30分）を過ぎたら、自分の端末が開いたときに自動削除する
 *    （他人のメッセージは消さない。ルールで削除権限を絞れるようにするため）
 *
 * 「履歴を残さない」ための方針は FIREBASE_SETUP.md を参照。
 */

export interface ChatMessage {
  id: string;
  uid: string;
  name: string;
  text: string;
  /** サーバー時刻(ms)。書き込み直後は null になることがある */
  at: number | null;
}

export const CHAT_MAX_LEN = 120;
const SEND_INTERVAL_MS = 700;
const TTL_MS = 30 * 60 * 1000;
const MAX_KEEP = 120;
const PRUNE_INTERVAL_MS = 60 * 1000;

function friendlyError(e: any): string {
  const msg = String(e?.message ?? e ?? '');
  if (/permission|denied|401|403/i.test(msg)) {
    return 'チャットの権限がありません（Realtime Database のルールで chats を許可してください）';
  }
  return msg || 'チャットの通信に失敗しました';
}

function normalize(id: string, raw: any): ChatMessage | null {
  const text = typeof raw?.text === 'string' ? raw.text : '';
  if (!text) return null;
  return {
    id,
    uid: typeof raw?.uid === 'string' ? raw.uid : '',
    name: typeof raw?.name === 'string' && raw.name ? raw.name : 'プレイヤー',
    text,
    at: typeof raw?.at === 'number' ? raw.at : null,
  };
}

export function useChat(code: string | null, me: { uid: string | null; name: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [open, setOpenState] = useState(false);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const openRef = useRef(false);
  const meRef = useRef(me);
  const seenRef = useRef<Set<string>>(new Set());
  const primedRef = useRef<string | null>(null);
  const lastSentRef = useRef(0);
  const lastPruneRef = useRef(0);

  meRef.current = me;

  const setOpen = useCallback((v: boolean) => {
    openRef.current = v;
    setOpenState(v);
    if (v) setUnread(0);
  }, []);

  // メッセージ購読（匿名認証が終わって uid が入ってから購読する）
  useEffect(() => {
    seenRef.current = new Set();
    primedRef.current = null;
    setMessages([]);
    setUnread(0);
    setError(null);
    if (!code || !me.uid) return;

    const unsub = onValue(
      ref(db, `chats/${code}/messages`),
      (snap) => {
        const val = (snap.val() ?? {}) as Record<string, any>;
        const list = Object.entries(val)
          .map(([id, raw]) => normalize(id, raw))
          .filter((m): m is ChatMessage => !!m);
        // 時系列順。at が揃っていればそれを使い、無ければ push ID（時刻順）で並べる
        list.sort((a, b) => {
          if (a.at !== null && b.at !== null && a.at !== b.at) return a.at - b.at;
          return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
        });
        const trimmed = list.slice(-MAX_KEEP);

        const myUid = meRef.current.uid;
        if (primedRef.current !== code) {
          // 初回スナップショットは既読扱い（入室直後に未読が大量につかないように）
          trimmed.forEach((m) => seenRef.current.add(m.id));
          primedRef.current = code;
        } else {
          let fresh = 0;
          for (const m of trimmed) {
            if (seenRef.current.has(m.id)) continue;
            seenRef.current.add(m.id);
            if (m.uid !== myUid && !openRef.current) fresh++;
          }
          if (fresh > 0) setUnread((u) => u + fresh);
        }
        if (openRef.current) setUnread(0);
        setMessages(trimmed);
        setError(null);
      },
      (e) => setError(friendlyError(e)),
    );
    return () => unsub();
  }, [code, me.uid]);

  /** 古い自分のメッセージを掃除する（TTL） */
  const prune = useCallback(async () => {
    const c = code;
    const myUid = meRef.current.uid;
    if (!c || !myUid) return;
    if (Date.now() - lastPruneRef.current < PRUNE_INTERVAL_MS) return;
    lastPruneRef.current = Date.now();
    try {
      const snap = await get(ref(db, `chats/${c}/messages`));
      const val = (snap.val() ?? {}) as Record<string, any>;
      const now = Date.now();
      const jobs: Promise<void>[] = [];
      for (const [id, m] of Object.entries(val)) {
        if (m?.uid !== myUid) continue;
        if (typeof m?.at === 'number' && now - m.at > TTL_MS) {
          jobs.push(remove(ref(db, `chats/${c}/messages/${id}`)));
        }
      }
      if (jobs.length > 0) await Promise.allSettled(jobs);
    } catch {
      /* ルールで削除できない場合もあるので黙って諦める */
    }
  }, [code]);

  useEffect(() => {
    if (open) void prune();
  }, [open, prune]);

  /** 送信。成功したら true */
  const send = useCallback(
    async (raw: string): Promise<boolean> => {
      const c = code;
      const myUid = meRef.current.uid;
      const text = raw.trim().slice(0, CHAT_MAX_LEN);
      if (!c || !myUid || !text) return false;
      if (Date.now() - lastSentRef.current < SEND_INTERVAL_MS) return false;
      lastSentRef.current = Date.now();
      try {
        await push(ref(db, `chats/${c}/messages`), {
          uid: myUid,
          name: (meRef.current.name || 'プレイヤー').slice(0, 20),
          text,
          at: serverTimestamp(),
        });
        setError(null);
        return true;
      } catch (e: any) {
        setError(friendlyError(e));
        return false;
      }
    },
    [code],
  );

  return {
    messages,
    meUid: me.uid,
    open,
    unread,
    error,
    setOpen,
    send,
    clearError: () => setError(null),
  };
}

export type ChatState = ReturnType<typeof useChat>;
