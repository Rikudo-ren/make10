import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  get,
  limitToLast,
  onDisconnect,
  onValue,
  push,
  query,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
} from 'firebase/database';
import { app, auth, db, ensureAnonymousAuth } from '../firebase';
import { getRankPoints } from './scoring';
import { generatePuzzleAsync, puzzleKey, type GenerateProgress } from './puzzle';
import {
  hasAnyPlayer,
  HEARTBEAT_MS,
  ROOM_TTL_MS,
  sweepOnce,
  SWEEP_INTERVAL_MS,
  TOUCH_THROTTLE_MS,
  type RoomIndex,
} from './roomCleanup';
import { DEFAULT_SETTINGS, normalizeSettings, type RoomData, type Settings } from './types';
import { assignTeams, clampTeamCount, isValidTeamId, pickJoinTeamId } from './teams';
import { generateFactorPuzzle } from './factor';

export { EMPTY_ROOM_GRACE_MS, ROOM_TTL_MS, SWEEP_INTERVAL_MS } from './roomCleanup';

/** 問題生成の締切(ms)。これを超えたら諦めてエラーを出す（UIは固まらない） */
const GENERATE_DEADLINE_MS = 3000;
/** チャットの保持件数（これを超えた古いメッセージは自動削除される） */
export const CHAT_KEEP = 60;
/** チャット1件の最大文字数 */
export const CHAT_MAX_LEN = 140;
/** 連投防止(ms) */
const CHAT_COOLDOWN_MS = 500;
/**
 * 旧バージョンで作られた（期限情報の無い）ルームの移行スキャン間隔。
 * これらも「誰もいなければ即削除」の対象になる。
 */
const LEGACY_SCAN_KEY = 'make10.legacyScanAt';
const LEGACY_SCAN_INTERVAL_MS = 24 * 60 * 60 * 1000;

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(len = 6) {
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return out;
}

function uniqueName(base: string, taken: string[]) {
  const trimmed = (base || 'プレイヤー').slice(0, 16);
  if (!taken.includes(trimmed)) return trimmed;
  for (let i = 2; i < 100; i++) {
    const cand = `${trimmed}${i}`.slice(0, 20);
    if (!taken.includes(cand)) return cand;
  }
  return `${trimmed}${Math.floor(Math.random() * 1000)}`.slice(0, 20);
}


/** 参加前にルームを覗いたときの情報（チーム選択UI用。在室扱いにはならない） */
export interface JoinPreview {
  code: string;
  status: RoomData['status'];
  battleMode: Settings['battleMode'];
  teamCount: number;
  teamAssignMode: Settings['teamAssignMode'];
  playerCount: number;
  /** チームごとの現在のメンバー（表示名・得点） */
  teams: { teamId: number; members: { name: string; score: number }[] }[];
  /** 過去の記録（得点・所属）が残っている再参加かどうか */
  isReturning: boolean;
  /** 保存されていた自分の得点（無ければ null） */
  myScore: number | null;
  /** 保存されていた自分の所属（無ければ null） */
  myTeamId: number | null;
  /** チームを自分で選ぶ必要があるか（チーム戦で、保存済みの所属が無いとき） */
  needsTeamChoice: boolean;
}

export interface RoomState {
  uid: string | null;
  authError: string | null;
  roomId: string | null;
  room: RoomData | null;
  busy: boolean;
  error: string | null;
  serverNow: () => number;
  rttMs: number;
}

export function useRoom() {
  const [uid, setUid] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rttMs, setRttMs] = useState(0);
  const [genProgress, setGenProgress] = useState<GenerateProgress | null>(null);
  const offsetRef = useRef(0);
  const roomRef = useRef<RoomData | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const lastChatAtRef = useRef(0);
  const uidRef = useRef<string | null>(null);
  /** 自分から退出したときは「解散されました」通知を出さない */
  const selfLeaveRef = useRef(false);
  /** ルームTTLの延長を最後に行った時刻 */
  const lastTouchRef = useRef(0);
  /** 自分の準備状態（再接続時に復元するため） */
  const myReadyRef = useRef<boolean>(false);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
  const finalizedRef = useRef<Set<number>>(new Set());
  const startingRef = useRef(false);
  const lastStateKeyRef = useRef('');

  roomRef.current = room;
  roomIdRef.current = roomId;
  uidRef.current = uid;

  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

  // 匿名認証 + サーバー時刻オフセット
  useEffect(() => {
    let mounted = true;
    ensureAnonymousAuth()
      .then((user) => {
        if (mounted) setUid(user.uid);
      })
      .catch((e) => {
        if (mounted) setAuthError(e?.message ?? '接続に失敗しました');
      });
    const unsub = onValue(ref(db, '.info/serverTimeOffset'), (snap) => {
      const v = snap.val();
      if (typeof v === 'number') offsetRef.current = v;
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  // ルーム購読
  useEffect(() => {
    if (!roomId) {
      setRoom(null);
      return;
    }
    const unsub = onValue(
      ref(db, `rooms/${roomId}`),
      (snap) => {
        const val = snap.val();
        if (!val) {
          // ルームが消えた（GMが退出して削除した／別端末で削除された）
          // → トップへ戻し、次回起動時に存在しないルームへ自動復帰しないようにする
          localStorage.removeItem('make10.room');
          setRoom(null);
          setRoomId(null);
          if (!selfLeaveRef.current) {
            setError('ルームが解散されました（GMが退出した可能性があります）');
          }
          return;
        }
        setRoom({ ...val, settings: normalizeSettings(val.settings) } as RoomData);
      },
      (e) => setError(e.message),
    );
    return () => unsub();
  }, [roomId]);

  const players = useMemo(() => {
    const p = room?.players ?? {};
    return Object.entries(p)
      .filter(([, v]) => v && typeof v.name === 'string' && v.name.length > 0)
      .map(([id, v]) => ({ uid: id, ...v }));
  }, [room]);

  const isGM = !!uid && !!room && room.gmUid === uid;

  const measureRtt = useCallback(
    async (code: string, myUid: string) => {
      try {
        const t0 = Date.now();
        await set(ref(db, `rooms/${code}/players/${myUid}/rttMs`), 0);
        const rtt = Math.min(3000, Math.max(0, Date.now() - t0));
        await set(ref(db, `rooms/${code}/players/${myUid}/rttMs`), rtt);
        setRttMs(rtt);
      } catch {
        /* noop */
      }
    },
    [],
  );

  const attachPresence = useCallback((code: string, myUid: string) => {
    onDisconnect(ref(db, `rooms/${code}/players/${myUid}/name`)).remove();
    onDisconnect(ref(db, `rooms/${code}/players/${myUid}/isReady`)).remove();
  }, []);

  /** ルームの有効期限を「今 + 24時間」に更新する（TTLの起点＝最終アクセス） */
  const touchRoom = useCallback(async (code: string) => {
    lastTouchRef.current = Date.now();
    try {
      const base = serverNow();
      const expiresAt = base + ROOM_TTL_MS;
      await update(ref(db), {
        [`rooms/${code}/expiresAt`]: expiresAt,
        [`rooms/index/${code}/expiresAt`]: expiresAt,
      });
    } catch {
      /* オフライン時などは無視（在室中の再延長は定期実行される） */
    }
  }, [serverNow]);

  /**
   * ルームの掃除。
   *
   * - 最終アクセスから24時間経過 → 削除（期限切れ）
   * - **在室者が0人 → 作成から15秒の猶予を過ぎていれば即削除**
   *
   * 「最近ハートビートが来ている部屋」は在室確認すらしないので、
   * 誰かが入っている部屋が誤って消えることはない。
   * Cloud Functions を使わずに済むよう、アプリを開いているクライアントが実行する。
   */
  const sweepRooms = useCallback(async () => {
    try {
      await sweepOnce({
        now: serverNow(),
        readIndex: async () => {
          const snap = await get(ref(db, 'rooms/index'));
          return (snap.val() ?? {}) as RoomIndex;
        },
        readPlayers: async (code) => {
          const snap = await get(ref(db, `rooms/${code}/players`));
          return snap.val();
        },
        apply: async (updates) => {
          await update(ref(db), updates);
        },
      });
    } catch {
      /* 掃除できなくてもゲーム進行には影響しない */
    }
  }, [serverNow]);

  /**
   * 旧バージョンで作られたルーム（rooms/index に載っていない）に期限を付ける。
   * 1日1回だけ、浅い取得（shallow）でルームコード一覧を取り、期限を書き込む。
   * これで「前からあるルーム」も24時間後に消える。
   */
  const migrateLegacyRooms = useCallback(async () => {
    try {
      const last = Number(localStorage.getItem(LEGACY_SCAN_KEY) ?? 0);
      if (Number.isFinite(last) && Date.now() - last < LEGACY_SCAN_INTERVAL_MS) return;
      const user = auth.currentUser;
      if (!user) return;
      localStorage.setItem(LEGACY_SCAN_KEY, String(Date.now()));

      const baseUrl = (app.options as { databaseURL?: string }).databaseURL;
      if (!baseUrl) return;
      const token = await user.getIdToken();
      const res = await fetch(`${baseUrl}/rooms.json?shallow=true&auth=${token}`);
      if (!res.ok) return;
      const raw = (await res.json()) ?? {};
      const codes = Object.keys(raw).filter((c) => c !== 'index');
      if (codes.length === 0) return;

      const idxSnap = await get(ref(db, 'rooms/index'));
      const index = (idxSnap.val() ?? {}) as RoomIndex;
      const nowMs = serverNow();
      const updates: Record<string, number> = {};
      for (const code of codes) {
        if (index[code]?.expiresAt) continue;
        updates[`rooms/${code}/expiresAt`] = nowMs + ROOM_TTL_MS;
        updates[`rooms/index/${code}/expiresAt`] = nowMs + ROOM_TTL_MS;
        updates[`rooms/index/${code}/createdAt`] = nowMs;
      }
      if (Object.keys(updates).length > 0) await update(ref(db), updates);
    } catch {
      /* 移行できなくてもゲーム進行には影響しない */
    }
  }, [serverNow]);

  /**
   * 参加しようとしたルームが期限切れなら削除して true を返す。
   * 参加してから消えるのを防ぐための最終チェック。
   */
  const dropExpiredRoom = useCallback(
    async (code: string) => {
      try {
        const snap = await get(ref(db, `rooms/index/${code}`));
        const entry = snap.val() as { expiresAt?: number; createdAt?: number } | null;
        const nowMs = serverNow();
        const exp = entry?.expiresAt;
        if (typeof exp !== 'number' || !Number.isFinite(exp)) {
          // 旧バージョンで作られたルーム → 今から24時間の期限を付ける
          if (!entry) {
            await set(ref(db, `rooms/index/${code}`), { expiresAt: nowMs + ROOM_TTL_MS, createdAt: nowMs });
          }
          return false;
        }
        if (exp > nowMs) return false;
        await remove(ref(db, `rooms/${code}`));
        await remove(ref(db, `rooms/index/${code}`));
        return true;
      } catch {
        return false;
      }
    },
    [serverNow],
  );

  // 掃除: 起動時 + 20秒おき。
  // 「誰もいない部屋」は作成から20秒で、期限切れは24時間で削除する。
  // （Cloud Functions なしで動かすため、アプリを開いている人が掃除する）
  useEffect(() => {
    if (!uid) return; // 未認証だと権限エラーになるので認証後に実行
    void migrateLegacyRooms();
    void sweepRooms();
    const id = setInterval(() => void sweepRooms(), SWEEP_INTERVAL_MS);
    return () => clearInterval(id);
  }, [migrateLegacyRooms, sweepRooms, uid]);

  /** 実際の操作（解答・パス・チャット等）があったときにTTLを延長する（1分に1回まで） */
  const markActivity = useCallback(() => {
    const code = roomIdRef.current;
    if (!code) return;
    if (Date.now() - lastTouchRef.current < TOUCH_THROTTLE_MS) return;
    void touchRoom(code);
  }, [touchRoom]);

  // コールバックの依存配列を増やさずにどこからでも呼べるようにしておく
  const markActivityRef = useRef(markActivity);
  markActivityRef.current = markActivity;

  // 在室中は20秒おきにハートビート（タブを開いている限り「誰もいない部屋」にならない）
  useEffect(() => {
    if (!uid || !roomId) return;
    markActivityRef.current();
    const id = setInterval(() => markActivityRef.current(), HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [roomId, uid]);

  /**
   * 再接続時の在室復元。
   * 通信が切れると onDisconnect が players/{uid}/name を消すため、
   * 戻ってきたときに名前（と準備状態）を書き直す。
   * すでにルームが削除されていた場合は、中途半端な部屋を作らないよう何もしない。
   */
  useEffect(() => {
    const unsub = onValue(ref(db, '.info/connected'), (snap) => {
      if (snap.val() !== true) return;
      const code = roomIdRef.current;
      const myUid = uidRef.current;
      const data = roomRef.current;
      if (!code || !myUid || !data) return;
      void (async () => {
        try {
          const gm = await get(ref(db, `rooms/${code}/gmUid`));
          if (!gm.exists()) return; // 削除済み → 購読側でトップ画面に戻る
          // 同じコードで別のルームが作り直されていた場合は触らない
          if (data.gmUid && gm.val() !== data.gmUid) return;
          const me = data.players?.[myUid];
          const name =
            (me?.name && me.name.length > 0 ? me.name : null) ??
            localStorage.getItem('make10.name') ??
            'プレイヤー';
          const isReady = myReadyRef.current ?? data.gmUid === myUid;
          await update(ref(db, `rooms/${code}/players/${myUid}`), { name, isReady });
          attachPresence(code, myUid);
          void touchRoom(code);
        } catch {
          /* noop */
        }
      })();
    });
    return () => unsub();
  }, [attachPresence, touchRoom]);

  const createRoom = useCallback(
    async (name: string, settings: Settings = DEFAULT_SETTINGS) => {
      setError(null);
      setBusy(true);
      try {
        const myUid = uid ?? (await ensureAnonymousAuth()).uid;
        setUid(myUid);
        let code = randomCode();
        for (let i = 0; i < 5; i++) {
          const snap = await get(ref(db, `rooms/${code}/gmUid`));
          if (!snap.exists()) break;
          code = randomCode();
        }
        await set(ref(db, `rooms/${code}/gmUid`), myUid);
        await set(ref(db, `rooms/${code}/status`), 'lobby');
        await update(ref(db, `rooms/${code}/settings`), settings);
        await update(ref(db, `rooms/${code}/players/${myUid}`), {
          name: (name || 'GM').slice(0, 20),
          isReady: true,
          rttMs: 0,
        });
        await set(ref(db, `rooms/${code}/players/${myUid}/score`), 0);
        await set(ref(db, `rooms/${code}/expiresAt`), serverNow() + ROOM_TTL_MS);
        await set(ref(db, `rooms/index/${code}`), {
          expiresAt: serverNow() + ROOM_TTL_MS,
          createdAt: serverNow(),
        });
        lastTouchRef.current = Date.now();
        myReadyRef.current = true;
        attachPresence(code, myUid);
        selfLeaveRef.current = false;
        localStorage.setItem('make10.room', code);
        setRoomId(code);
        measureRtt(code, myUid);
        return code;
      } catch (e: any) {
        setError(e?.message ?? 'ルーム作成に失敗しました');
        return null;
      } finally {
        setBusy(false);
      }
    },
    [attachPresence, measureRtt, serverNow, uid],
  );

  /**
   * 参加せずにルームを覗く（途中参加時のチーム選択用）。
   * ここでは players に書き込まないので、在室扱いにもならず部屋も作られない。
   */
  const peekRoom = useCallback(
    async (code0: string): Promise<JoinPreview | null> => {
      setError(null);
      setBusy(true);
      const code = code0.trim().toUpperCase();
      try {
        const myUid = uid ?? (await ensureAnonymousAuth()).uid;
        setUid(myUid);
        const snap = await get(ref(db, `rooms/${code}`));
        if (!snap.exists()) {
          setError('そのルームコードは見つかりませんでした');
          return null;
        }
        if (await dropExpiredRoom(code)) {
          setError('そのルームは有効期限切れ（24時間アクセスなし）で削除されました');
          return null;
        }
        const data = snap.val() as RoomData;
        const settings = normalizeSettings(data.settings);
        const playerList = Object.entries(data.players ?? {})
          .filter(([, v]) => v && typeof v.name === 'string' && v.name.length > 0)
          .map(([pUid, v]) => ({
            uid: pUid,
            name: v.name,
            score: v.score ?? 0,
            teamId: v.teamId ?? null,
          }));
        const teams = Array.from({ length: settings.teamCount }, (_, teamId) => ({
          teamId,
          members: playerList
            .filter((p) => p.teamId === teamId)
            .sort((a, b) => b.score - a.score)
            .map((p) => ({ name: p.name, score: p.score })),
        }));
        const mine = data.players?.[myUid];
        const myTeamId = isValidTeamId(mine?.teamId, settings.teamCount)
          ? Math.floor(Number(mine?.teamId))
          : null;
        return {
          code,
          status: data.status,
          battleMode: settings.battleMode,
          teamCount: settings.teamCount,
          teamAssignMode: settings.teamAssignMode,
          playerCount: playerList.length,
          teams,
          // 退出しても score / teamId はサーバーに残るので、それがあれば再参加として扱う
          isReturning: !!mine && (typeof mine.score === 'number' || mine.teamId != null),
          myScore: typeof mine?.score === 'number' ? mine.score : null,
          myTeamId,
          needsTeamChoice: settings.battleMode === 'team' && myTeamId === null,
        };
      } catch (e: any) {
        setError(e?.message ?? 'ルームの確認に失敗しました');
        return null;
      } finally {
        setBusy(false);
      }
    },
    [dropExpiredRoom, uid],
  );

  const joinRoom = useCallback(
    async (code0: string, name: string, requestedTeamId?: number | null) => {
      setError(null);
      setBusy(true);
      const code = code0.trim().toUpperCase();
      try {
        const myUid = uid ?? (await ensureAnonymousAuth()).uid;
        setUid(myUid);
        const snap = await get(ref(db, `rooms/${code}`));
        if (!snap.exists()) {
          setError('そのルームコードは見つかりませんでした');
          return null;
        }
        // 期限切れ（24時間アクセスなし）のルームは参加前に破棄する
        if (await dropExpiredRoom(code)) {
          setError('そのルームは有効期限切れ（24時間アクセスなし）で削除されました');
          return null;
        }
        const data = snap.val() as RoomData;
        const settings = normalizeSettings(data.settings);
        const existing = data.players?.[myUid];
        const taken = Object.entries(data.players ?? {})
          .filter(([id]) => id !== myUid)
          .map(([, v]) => v?.name)
          .filter(Boolean) as string[];
        const playerUpdates: Record<string, unknown> = {
          name: uniqueName(name, taken),
          isReady: false,
          rttMs: 0,
        };
        // 得点は保存済みのものを絶対に上書きしない（抜けた人が戻ると復活する）。
        // まだ得点を持っていない新規参加だけ 0 で初期化する。
        if (typeof existing?.score !== 'number') playerUpdates.score = 0;
        if (settings.battleMode === 'team') {
          // 所属の復元 > 本人の選択 > 人数が一番少ないチーム、の順で決める
          playerUpdates.teamId = pickJoinTeamId({
            players: Object.entries(data.players ?? {}).map(([pUid, v]) => ({
              uid: pUid,
              score: v?.score ?? 0,
              teamId: v?.teamId ?? null,
            })),
            teamCount: settings.teamCount,
            existingTeamId: existing?.teamId ?? null,
            requestedTeamId: requestedTeamId ?? null,
          });
        }
        await update(ref(db, `rooms/${code}/players/${myUid}`), playerUpdates);
        // 掃除と競合して消された場合は、中途半端な部屋を作らずに戻る
        const gmSnap = await get(ref(db, `rooms/${code}/gmUid`));
        if (!gmSnap.exists()) {
          await remove(ref(db, `rooms/${code}`)).catch(() => undefined);
          await remove(ref(db, `rooms/index/${code}`)).catch(() => undefined);
          localStorage.removeItem('make10.room');
          setError('そのルームは解散されました');
          return null;
        }
        attachPresence(code, myUid);
        myReadyRef.current = false;
        selfLeaveRef.current = false;
        await touchRoom(code);
        localStorage.setItem('make10.room', code);
        setRoomId(code);
        measureRtt(code, myUid);
        return code;
      } catch (e: any) {
        setError(e?.message ?? 'ルーム参加に失敗しました');
        return null;
      } finally {
        setBusy(false);
      }
    },
    [attachPresence, dropExpiredRoom, measureRtt, touchRoom, uid],
  );

  // 再読み込み時の自動復帰（匿名UIDは端末に保持されるので得点も維持される）
  useEffect(() => {
    if (!uid || roomIdRef.current) return;
    const saved = localStorage.getItem('make10.room');
    if (!saved) return;
    let cancelled = false;
    (async () => {
      try {
        const meSnap = await get(ref(db, `rooms/${saved}/players/${uid}`));
        if (cancelled) return;
        if (!meSnap.exists()) {
          localStorage.removeItem('make10.room');
          return;
        }
        const name = meSnap.val()?.name ?? localStorage.getItem('make10.name') ?? 'プレイヤー';
        await update(ref(db, `rooms/${saved}/players/${uid}`), { name, rttMs: 0 });
        attachPresence(saved, uid);
        void touchRoom(saved);
        setRoomId(saved);
        measureRtt(saved, uid);
      } catch {
        localStorage.removeItem('make10.room');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attachPresence, measureRtt, touchRoom, uid]);

  const leaveRoom = useCallback(async () => {
    const code = roomIdRef.current;
    const data = roomRef.current;
    const myUid = uidRef.current;
    if (code && myUid) {
      try {
        if (data?.gmUid === myUid) {
          // GMが退出したらルームごと削除する。
          // （チャット・スコア・履歴をサーバーに残さないための後片付け）
          await remove(ref(db, `rooms/${code}`));
          await remove(ref(db, `rooms/index/${code}`));
        } else {
          await remove(ref(db, `rooms/${code}/players/${myUid}/name`));
          await remove(ref(db, `rooms/${code}/players/${myUid}/isReady`));
          // 退出した結果だれもいなくなったら、掃除を待たずにその場で消す
          try {
            const left = await get(ref(db, `rooms/${code}/players`));
            if (!hasAnyPlayer(left.val())) {
              await remove(ref(db, `rooms/${code}`));
              await remove(ref(db, `rooms/index/${code}`));
            }
          } catch {
            /* noop */
          }
        }
      } catch {
        /* noop */
      }
    }
    finalizedRef.current = new Set();
    selfLeaveRef.current = true;
    setGenProgress(null);
    localStorage.removeItem('make10.room');
    setRoomId(null);
    setRoom(null);
  }, []);

  const setReady = useCallback(
    async (ready: boolean) => {
    markActivityRef.current();
      if (!roomId || !uid) return;
      await set(ref(db, `rooms/${roomId}/players/${uid}/isReady`), ready);
    },
    [roomId, uid],
  );

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
    markActivityRef.current();
      if (!roomId || !isGM) return;
      await update(ref(db, `rooms/${roomId}/settings`), patch);
    },
    [isGM, roomId],
  );

  /** チーム戦: GMが特定プレイヤーの所属チームを変更する（ロビーの手動分け用） */
  const setPlayerTeam = useCallback(
    async (targetUid: string, teamId: number | null) => {
      markActivityRef.current();
      const code = roomIdRef.current;
      const data = roomRef.current;
      if (!code || !data || data.gmUid !== uidRef.current) return;
      const teamCount = clampTeamCount(normalizeSettings(data.settings).teamCount);
      const value =
        teamId === null || !Number.isFinite(teamId)
          ? null
          : Math.min(teamCount - 1, Math.max(0, Math.floor(teamId)));
      try {
        await set(ref(db, `rooms/${code}/players/${targetUid}/teamId`), value);
      } catch (e: any) {
        setError(e?.message ?? 'チームの変更に失敗しました');
      }
    },
    [],
  );

  /**
   * チーム戦: 自分がチームを選んで入る（途中参加者用）。
   * 既に所属が決まっている場合は勝手な移籍を防ぐため何もしない
   * （所属の変更はGMの setPlayerTeam だけが行える）。
   */
  const joinTeam = useCallback(async (teamId: number) => {
    markActivityRef.current();
    const code = roomIdRef.current;
    const data = roomRef.current;
    const myUid = uidRef.current;
    if (!code || !data || !myUid) return;
    const settings = normalizeSettings(data.settings);
    if (settings.battleMode !== 'team') return;
    if (!isValidTeamId(teamId, settings.teamCount)) return;
    if (isValidTeamId(data.players?.[myUid]?.teamId, settings.teamCount)) return;
    try {
      await set(ref(db, `rooms/${code}/players/${myUid}/teamId`), Math.floor(teamId));
    } catch (e: any) {
      setError(e?.message ?? 'チームへの参加に失敗しました');
    }
  }, []);

  /**
   * チーム戦: 現在の設定でチーム分けを実行して全員へ配信する（GMのみ）。
   * ロビーで事前に振り分けて確認したり、ランダムを振り直したりするのに使う。
   * 試合開始時（startMatch）にも同じ処理が走るため、ここで分けなくても開始できる。
   */
  const assignTeamsNow = useCallback(async () => {
    markActivityRef.current();
    const code = roomIdRef.current;
    const data = roomRef.current;
    if (!code || !data || data.gmUid !== uidRef.current) return;
    const settings = normalizeSettings(data.settings);
    if (settings.battleMode !== 'team') return;
    const list = Object.entries(data.players ?? {})
      .filter(([, v]) => v && typeof v.name === 'string' && v.name.length > 0)
      .map(([pUid, v]) => ({ uid: pUid, name: v.name, score: v.score ?? 0, teamId: v.teamId ?? null }));
    const assignment = assignTeams({
      players: list,
      teamCount: settings.teamCount,
      mode: settings.teamAssignMode,
    });
    try {
      const updates: Record<string, number> = {};
      for (const [pUid, teamId] of Object.entries(assignment)) {
        updates[`rooms/${code}/players/${pUid}/teamId`] = teamId;
      }
      if (Object.keys(updates).length > 0) await update(ref(db), updates);
    } catch (e: any) {
      setError(e?.message ?? 'チーム分けに失敗しました');
    }
  }, []);

  /**
   * 出題を生成して配信（GMのみ）。
   * 生成は非同期・タイムスライスなので、重い設定でもブラウザが固まらない。
   * 生成中は rooms/{code}/preparingAt を立てて、全員に「準備中」を表示する。
   */
  const startRound = useCallback(
    async (globalIndex: number, matchStartIndex: number, settings: Settings, avoid?: string) => {
      const code = roomIdRef.current;
      if (!code) return;
      if (startingRef.current) return;
      startingRef.current = true;
      setError(null);
      setGenProgress({ attempts: 0, elapsedMs: 0, deadlineMs: GENERATE_DEADLINE_MS });
      try {
        await set(ref(db, `rooms/${code}/preparingAt`), serverTimestamp());
        // ゲーム種別で出題を分岐する（同じ部屋・同じ進行管理のまま中身だけ変える）
        let roundFields: Record<string, unknown>;
        if (settings.gameMode === 'factor') {
          const fp = generateFactorPuzzle({
            digits: settings.factorDigits,
            minPrime: settings.factorMinPrime,
            maxPrime: settings.factorMaxPrime,
            countMin: settings.factorCountMin,
            countMax: settings.factorCountMax,
          });
          if (!fp) {
            setError(
              'この設定では条件に合う合成数を作れませんでした。桁数・下限素数・上限素数・素因数の個数を見直してください（ラウンドは開始していません）。',
            );
            return;
          }
          roundFields = {
            gameMode: 'factor',
            numbers: [fp.value],
            target: fp.value,
            factorNumber: fp.value,
            factorAnswer: fp.factors,
            solutions: [],
            solutionCount: 1,
            difficultyLabel: settings.showDifficulty ? `素因数 ${fp.factors.length}個` : null,
          };
        } else {
          const puzzle = await generatePuzzleAsync(settings, {
            deadlineMs: GENERATE_DEADLINE_MS,
            avoid,
            onProgress: (p) => setGenProgress(p),
          });
          if (!puzzle) {
            setError(
              'この設定では時間内に解ける問題を作れませんでした。数字の範囲・演算子・目標値を見直してください（ラウンドは開始していません）。',
            );
            return;
          }
          roundFields = {
            gameMode: 'make10',
            numbers: puzzle.numbers,
            target: puzzle.target,
            factorNumber: null,
            factorAnswer: null,
            solutions: puzzle.solutions,
            solutionCount: puzzle.solutionCount,
            difficultyLabel: settings.showDifficulty ? puzzle.difficultyLabel : null,
          };
        }
        // status と currentRound を同時更新し、問題切り替え時のチラ見えを防ぐ。
        // startedAt がサーバー時刻に解決されるまでクライアント側でカウントダウンマスクをかける。
        await update(ref(db, `rooms/${code}`), {
          status: 'playing',
          preparingAt: null,
          currentRound: {
            roundIndex: globalIndex,
            matchStartIndex,
            startedAt: serverTimestamp(),
            winnerUid: null,
            outcome: null,
            results: null,
            endedAt: null,
            ...roundFields,
          },
        });
      } catch (e: any) {
        setError(e?.message ?? '出題の配信に失敗しました');
      } finally {
        startingRef.current = false;
        setGenProgress(null);
        try {
          await remove(ref(db, `rooms/${code}/preparingAt`));
        } catch {
          /* noop */
        }
      }
    },
    [],
  );

  const startMatch = useCallback(async () => {
    const code = roomIdRef.current;
    const data = roomRef.current;
    if (!code || !data || !isGM) return;
    const settings = normalizeSettings(data.settings);
    const startIndex = (data.currentRound?.roundIndex ?? -1) + 1;
    finalizedRef.current = new Set();
    // 得点リセット
    const ids = Object.keys(data.players ?? {});
    for (const id of ids) {
      await set(ref(db, `rooms/${code}/players/${id}/score`), 0);
    }
    // チーム分け: バランス/ランダムは開始時に確定、手動はロビーの所属を引き継ぎ
    // 未所属だけ人数の少ないチームへ補充する。個人戦なら以前の所属を取り除く。
    // ※ バランス分けはリセット前のスコア（前回の結果）を使うので、得点リセットより
    //    先に data から読むこと（data はリセット前のスナップショット）。
    if (settings.battleMode === 'team') {
      const list = Object.entries(data.players ?? {})
        .filter(([, v]) => v && typeof v.name === 'string' && v.name.length > 0)
        .map(([pUid, v]) => ({ uid: pUid, name: v.name, score: v.score ?? 0, teamId: v.teamId ?? null }));
      const assignment = assignTeams({
        players: list,
        teamCount: settings.teamCount,
        mode: settings.teamAssignMode,
      });
      const updates: Record<string, number> = {};
      for (const [pUid, teamId] of Object.entries(assignment)) {
        updates[`rooms/${code}/players/${pUid}/teamId`] = teamId;
      }
      if (Object.keys(updates).length > 0) await update(ref(db), updates);
    } else {
      const updates: Record<string, null> = {};
      for (const id of ids) {
        if (data.players?.[id]?.teamId != null) {
          updates[`rooms/${code}/players/${id}/teamId`] = null;
        }
      }
      if (Object.keys(updates).length > 0) await update(ref(db), updates);
    }
    const prev = data.currentRound;
    await startRound(startIndex, startIndex, settings, prev ? puzzleKey(prev) : undefined);
  }, [isGM, startRound]);

  const submitAnswer = useCallback(
    async (formula: string, key: string) => {
    markActivityRef.current();
      const code = roomIdRef.current;
      const data = roomRef.current;
      if (!code || !data || !uid || !data.currentRound) return;
      // 受付終了後に届いた解答は書き込まない（結果表示とのズレ防止）
      if (data.status !== 'playing') return;
      const r = data.currentRound;
      // 各端末の経過時間（カウントダウン3秒分は除外）で順位付け
      const COUNTDOWN_MS = 3000;
      const elapsed = Math.max(
        0,
        Math.min(300000, Math.round(serverNow() - r.startedAt - COUNTDOWN_MS)),
      );
      try {
        await set(ref(db, `rooms/${code}/answers/${r.roundIndex}/${uid}`), {
          formula: formula.slice(0, 60),
          key,
          submittedAt: serverTimestamp(),
          adjustedElapsedMs: elapsed,
        });
      } catch (e: any) {
        setError(e?.message ?? '解答の送信に失敗しました');
      }
    },
    [serverNow, uid],
  );

  const passRound = useCallback(async () => {
    markActivityRef.current();
    const code = roomIdRef.current;
    const data = roomRef.current;
    if (!code || !data || !uid || !data.currentRound) return;
    if (data.status !== 'playing') return;
    const r = data.currentRound;
    try {
      await set(ref(db, `rooms/${code}/answers/${r.roundIndex}/${uid}`), {
        formula: 'PASS',
        key: '',
        submittedAt: serverTimestamp(),
        adjustedElapsedMs: 0,
        passed: true,
      });
    } catch {
      /* noop */
    }
  }, [uid]);

  /**
   * パスの取り消し。誤タップで解答できなくなった場合に、ラウンド中なら復帰できる。
   * （ラウンドが確定済みなら何もしない）
   */
  const cancelPass = useCallback(async () => {
    markActivityRef.current();
    const code = roomIdRef.current;
    const data = roomRef.current;
    const myUid = uidRef.current;
    if (!code || !data?.currentRound || !myUid) return;
    if (data.status !== 'playing') return;
    const roundIndex = data.currentRound.roundIndex;
    const mine = data.answers?.[String(roundIndex)]?.[myUid];
    if (!mine?.passed) return;
    try {
      await remove(ref(db, `rooms/${code}/answers/${roundIndex}/${myUid}`));
    } catch (e: any) {
      setError(e?.message ?? 'パスの取り消しに失敗しました');
    }
  }, []);

  /** チャット送信（ルーム内のみ・直近 CHAT_KEEP 件だけ保持） */
  const sendChat = useCallback(
    async (raw: string): Promise<boolean> => {
    markActivityRef.current();
      const code = roomIdRef.current;
      const data = roomRef.current;
      const myUid = uidRef.current;
      const text = (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX_LEN);
      if (!code || !data || !myUid || !text) return false;
      const t = Date.now();
      if (t - lastChatAtRef.current < CHAT_COOLDOWN_MS) return false;
      lastChatAtRef.current = t;
      try {
        const name = (data.players?.[myUid]?.name ?? 'プレイヤー').slice(0, 20);
        await set(push(ref(db, `rooms/${code}/chat`)), {
          uid: myUid,
          name,
          text,
          at: serverNow(),
        });
        // 古いメッセージを間引く（チャットがサーバーに溜まり続けないように）
        const snap = await get(query(ref(db, `rooms/${code}/chat`), limitToLast(CHAT_KEEP + 20)));
        const keys = Object.keys((snap.val() ?? {}) as Record<string, unknown>);
        if (keys.length > CHAT_KEEP) {
          const updates: Record<string, null> = {};
          for (const k of keys.slice(0, keys.length - CHAT_KEEP)) {
            updates[`rooms/${code}/chat/${k}`] = null;
          }
          await update(ref(db), updates);
        }
        return true;
      } catch (e: any) {
        setError(e?.message ?? 'チャットの送信に失敗しました');
        return false;
      }
    },
    [serverNow],
  );

  /** チャット全消去（GMのみ） */
  const clearChat = useCallback(async () => {
    const code = roomIdRef.current;
    if (!code || !isGM) return;
    try {
      await remove(ref(db, `rooms/${code}/chat`));
    } catch {
      /* noop */
    }
  }, [isGM]);

  /** ラウンド確定処理（GMのみ） */
  const finalizeRound = useCallback(
    async (outcome: 'answered' | 'passed' | 'timeup') => {
      const code = roomIdRef.current;
      const data = roomRef.current;
      if (!code || !data?.currentRound) return;
      const r = data.currentRound;
      if (finalizedRef.current.has(r.roundIndex)) return;
      finalizedRef.current.add(r.roundIndex);
      const settings = normalizeSettings(data.settings);

      // 全解答を取得して正解タイム順に並べる
      const snap = await get(ref(db, `rooms/${code}/answers/${r.roundIndex}`));
      const answers = (snap.val() ?? {}) as Record<
        string,
        { formula: string; key?: string; adjustedElapsedMs: number; passed?: boolean }
      >;
      const correct = Object.entries(answers)
        .filter(([, a]) => !a.passed)
        .sort((a, b) => a[1].adjustedElapsedMs - b[1].adjustedElapsedMs);

      const maxRank = settings.scoringMode === 'first' ? 1 : (settings.maxRankCount || 3);
      const results: Record<
        string,
        { adjustedElapsedMs: number; formula: string; key: string; gained: number; rank: number }
      > = {};

      for (let i = 0; i < correct.length; i++) {
        const [pUid, a] = correct[i];
        const rank = i + 1;
        const gained = getRankPoints(rank, maxRank, settings.scoringMode, settings.customRankPoints);
        results[pUid] = {
          adjustedElapsedMs: a.adjustedElapsedMs,
          formula: a.formula,
          key: a.key ?? '',
          gained,
          rank,
        };
      }

      // 加点はGMのみが書き込み可能
      for (const [pUid, res] of Object.entries(results)) {
        if (res.gained === 0) continue;
        const cur = data.players?.[pUid]?.score ?? 0;
        await set(ref(db, `rooms/${code}/players/${pUid}/score`), cur + res.gained);
      }

      const winnerUid = correct.length > 0 ? correct[0][0] : null;
      const finalOutcome = correct.length > 0 ? 'answered' : outcome;
      const finished: any = {
        ...r,
        endedAt: serverTimestamp(),
        winnerUid,
        outcome: finalOutcome,
        results,
      };

      // 結果を一度に書き込み status を 'judging' に移行
      await update(ref(db, `rooms/${code}`), {
        status: 'judging',
        currentRound: {
          ...r,
          winnerUid,
          outcome: finalOutcome,
          results,
          endedAt: serverTimestamp(),
        },
      });
      await set(ref(db, `rooms/${code}/history/${r.roundIndex}`), finished);
    },
    [],
  );

  /**
   * GM権限: この問題の「まだ正解していない人」を全員パス扱いにして即確定する。
   * 既に正解した人の解答はそのまま残るので、確定処理で順位どおり得点が入る。
   */
  const forcePassRemaining = useCallback(async () => {
    const code = roomIdRef.current;
    const data = roomRef.current;
    const myUid = uidRef.current;
    if (!code || !data || data.gmUid !== myUid) return;
    if (data.status !== 'playing' || !data.currentRound) return;
    const r = data.currentRound;
    try {
      const snap = await get(ref(db, `rooms/${code}/answers/${r.roundIndex}`));
      const answers = (snap.val() ?? {}) as Record<
        string,
        { formula: string; key?: string; adjustedElapsedMs: number; passed?: boolean }
      >;
      const activeIds = Object.entries(data.players ?? {})
        .filter(([, v]) => v && typeof v.name === 'string' && v.name.length > 0)
        .map(([pUid]) => pUid);
      const updates: Record<string, unknown> = {};
      for (const pUid of activeIds) {
        const a = answers[pUid];
        if (a && !a.passed) continue; // 正解済みはそのまま（得点対象）
        if (a?.passed) continue; // パス済みはそのまま
        updates[`rooms/${code}/answers/${r.roundIndex}/${pUid}`] = {
          formula: 'PASS',
          key: '',
          submittedAt: serverNow(),
          adjustedElapsedMs: 0,
          passed: true,
        };
      }
      if (Object.keys(updates).length > 0) await update(ref(db), updates);
      const hasCorrect = Object.values(answers).some((a) => a && !a.passed);
      // 1.3秒の「全員パス」タイマーを待たず、その場で確定して得点を入れる
      await finalizeRound(hasCorrect ? 'answered' : 'passed');
    } catch (e: any) {
      setError(e?.message ?? '強制パスに失敗しました');
    }
  }, [finalizeRound, serverNow]);

  /**
   * GM権限: 試合を強制終了してロビー（ゲーム設定）へ戻す。
   * 進行中のラウンドは破棄し、確定待ちタイマーが後から走らないよう確定済みにしておく。
   * プレイヤー・得点・所属チームはロビーにそのまま残る（ルーム自体は消さない）。
   */
  const forceEndToLobby = useCallback(async () => {
    const code = roomIdRef.current;
    const data = roomRef.current;
    const myUid = uidRef.current;
    if (!code || !data || data.gmUid !== myUid) return;
    if (data.status === 'lobby') return;
    if (data.currentRound) finalizedRef.current.add(data.currentRound.roundIndex);
    try {
      await update(ref(db, `rooms/${code}`), { status: 'lobby', preparingAt: null });
    } catch (e: any) {
      setError(e?.message ?? 'ロビーへ戻れませんでした');
    }
  }, []);

  const nextRound = useCallback(async () => {
    const code = roomIdRef.current;
    const data = roomRef.current;
    if (!code || !data?.currentRound || !isGM) return;
    if (data.status !== 'judging') return; // 二重進行の防止
    const settings = normalizeSettings(data.settings);
    const r = data.currentRound;
    const matchStartIndex = (r as any).matchStartIndex ?? 0;
    const played = r.roundIndex - matchStartIndex + 1;
    if (played >= settings.roundCount) {
      await set(ref(db, `rooms/${code}/status`), 'finished');
      return;
    }
    await startRound(r.roundIndex + 1, matchStartIndex, settings, puzzleKey(r));
  }, [isGM, startRound]);

  const backToLobby = useCallback(async () => {
    const code = roomIdRef.current;
    if (!code || !isGM) return;
    await set(ref(db, `rooms/${code}/status`), 'lobby');
  }, [isGM]);

  // ===== GM判定エンジン（定員制 & 未正解者全パスで即終了） =====
  useEffect(() => {
    const clearTimer = (k: string) => {
      const t = timersRef.current[k];
      if (t) clearTimeout(t);
      timersRef.current[k] = null;
    };
    const stateKey = `${room?.status ?? '-'}#${room?.currentRound?.roundIndex ?? -1}`;
    if (lastStateKeyRef.current !== stateKey) {
      lastStateKeyRef.current = stateKey;
      clearTimer('timeup');
      clearTimer('allpass');
    }
    if (!isGM || !room || !roomId) return;

    if (room.status !== 'playing' || !room.currentRound) {
      clearTimer('timeup');
      clearTimer('allpass');
      return;
    }
    const settings = normalizeSettings(room.settings);
    const r = room.currentRound;
    if (finalizedRef.current.has(r.roundIndex)) return;

    const answers = (room.answers?.[String(r.roundIndex)] ?? {}) as Record<string, any>;
    const activeIds = players.map((p) => p.uid);
    if (activeIds.length === 0) return;

    const correctIds = Object.entries(answers)
      .filter(([, a]) => a && !a.passed)
      .map(([id]) => id);

    // 入賞枠上限: 設定の maxRankCount か、参加者人数の小さい方（1位モードなら1）
    const targetCapacity = settings.scoringMode === 'first' ? 1 : Math.min(settings.maxRankCount || 3, activeIds.length);

    // 1) 定員（targetCapacity）が全員埋まったら即終了！
    if (correctIds.length >= targetCapacity) {
      clearTimer('timeup');
      clearTimer('allpass');
      finalizeRound('answered');
      return;
    }

    // 2) まだ正解していない人たち
    const unsolvedIds = activeIds.filter((id) => !correctIds.includes(id));
    // 未正解の人全員が「パス」を押したら、正解者が何人いようと（0人でも1人でも2人でも）即終了！
    const allUnsolvedPassed =
      unsolvedIds.length > 0 &&
      unsolvedIds.every((id) => answers[id]?.passed === true);

    if (allUnsolvedPassed) {
      clearTimer('timeup');
      // 誤タップした人がパスを取り消せるように、少しだけ猶予を置いてから確定する
      if (!timersRef.current['allpass']) {
        timersRef.current['allpass'] = setTimeout(() => {
          timersRef.current['allpass'] = null;
          finalizeRound(correctIds.length > 0 ? 'answered' : 'passed');
        }, 1300);
      }
      return;
    }
    clearTimer('allpass');

    // 3) 時間切れ監視（制限時間ありの場合のみ）
    if (!settings.unlimitedTime && !timersRef.current['timeup']) {
      const remain = r.startedAt + 3000 + settings.timeLimitSec * 1000 - serverNow();
      timersRef.current['timeup'] = setTimeout(() => {
        timersRef.current['timeup'] = null;
        finalizeRound(correctIds.length > 0 ? 'answered' : 'timeup');
      }, Math.max(200, remain));
    }
  }, [finalizeRound, isGM, players, room, roomId, serverNow]);

  // アンマウント時にタイマーを掃除
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      Object.values(timers).forEach((t) => t && clearTimeout(t));
    };
  }, []);

  return {
    uid,
    authError,
    roomId,
    room,
    players,
    isGM,
    busy,
    error,
    setError,
    rttMs,
    serverNow,
    createRoom,
    peekRoom,
    joinRoom,
    leaveRoom,
    setReady,
    updateSettings,
    setPlayerTeam,
    joinTeam,
    assignTeamsNow,
    startMatch,
    submitAnswer,
    passRound,
    cancelPass,
    nextRound,
    backToLobby,
    forcePassRemaining,
    forceEndToLobby,
    sendChat,
    clearChat,
    genProgress,
    preparing: !!room?.preparingAt,
  };
}

export type UseRoom = ReturnType<typeof useRoom>;
