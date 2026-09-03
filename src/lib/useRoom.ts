import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  get,
  onDisconnect,
  onValue,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
} from 'firebase/database';
import { db, ensureAnonymousAuth } from '../firebase';
import { generatePuzzle } from './puzzle';
import { DEFAULT_SETTINGS, normalizeSettings, type RoomData, type Settings } from './types';

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

export function getRankPoints(rank: number, maxRankCount: number, mode: 'rank' | 'first' | 'flat'): number {
  if (rank > maxRankCount) return 0;
  if (mode === 'first') return rank === 1 ? 1 : 0;
  if (mode === 'flat') return 1;
  // rank mode: 1位 = maxRankCount点, 2位 = maxRankCount - 1点, ...
  return Math.max(1, maxRankCount - rank + 1);
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
  const offsetRef = useRef(0);
  const roomRef = useRef<RoomData | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
  const finalizedRef = useRef<Set<number>>(new Set());
  const startingRef = useRef(false);
  const lastStateKeyRef = useRef('');

  roomRef.current = room;
  roomIdRef.current = roomId;

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
          setRoom(null);
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
        attachPresence(code, myUid);
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
    [attachPresence, measureRtt, uid],
  );

  const joinRoom = useCallback(
    async (code0: string, name: string) => {
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
        const data = snap.val() as RoomData;
        const taken = Object.entries(data.players ?? {})
          .filter(([id]) => id !== myUid)
          .map(([, v]) => v?.name)
          .filter(Boolean) as string[];
        await update(ref(db, `rooms/${code}/players/${myUid}`), {
          name: uniqueName(name, taken),
          isReady: false,
          rttMs: 0,
        });
        attachPresence(code, myUid);
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
    [attachPresence, measureRtt, uid],
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
        setRoomId(saved);
        measureRtt(saved, uid);
      } catch {
        localStorage.removeItem('make10.room');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attachPresence, measureRtt, uid]);

  const leaveRoom = useCallback(async () => {
    const code = roomIdRef.current;
    if (code && uid) {
      try {
        await remove(ref(db, `rooms/${code}/players/${uid}/name`));
        await remove(ref(db, `rooms/${code}/players/${uid}/isReady`));
      } catch {
        /* noop */
      }
    }
    finalizedRef.current = new Set();
    localStorage.removeItem('make10.room');
    setRoomId(null);
    setRoom(null);
  }, [uid]);

  const setReady = useCallback(
    async (ready: boolean) => {
      if (!roomId || !uid) return;
      await set(ref(db, `rooms/${roomId}/players/${uid}/isReady`), ready);
    },
    [roomId, uid],
  );

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      if (!roomId || !isGM) return;
      await update(ref(db, `rooms/${roomId}/settings`), patch);
    },
    [isGM, roomId],
  );

  /** 出題を生成して配信（GMのみ） */
  const startRound = useCallback(
    async (globalIndex: number, matchStartIndex: number, settings: Settings) => {
      const code = roomIdRef.current;
      if (!code) return;
      if (startingRef.current) return;
      startingRef.current = true;
      try {
        const puzzle = generatePuzzle(settings);
        if (!puzzle) {
          setError('この設定では解ける問題を生成できませんでした。設定を見直してください。');
          await set(ref(db, `rooms/${code}/status`), 'lobby');
          return;
        }
        // status と currentRound を同時更新し、問題切り替え時のチラ見えを防ぐ。
        // startedAt がサーバー時刻に解決されるまでクライアント側でカウントダウンマスクをかける。
        await update(ref(db, `rooms/${code}`), {
          status: 'playing',
          currentRound: {
            roundIndex: globalIndex,
            matchStartIndex,
            numbers: puzzle.numbers,
            target: puzzle.target,
            startedAt: serverTimestamp(),
            winnerUid: null,
            outcome: null,
            results: null,
            endedAt: null,
            solutions: puzzle.solutions,
            solutionCount: puzzle.solutionCount,
            difficultyLabel: settings.showDifficulty ? puzzle.difficultyLabel : null,
          },
        });
      } finally {
        startingRef.current = false;
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
    await startRound(startIndex, startIndex, settings);
  }, [isGM, startRound]);

  const submitAnswer = useCallback(
    async (formula: string) => {
      const code = roomIdRef.current;
      const data = roomRef.current;
      if (!code || !data || !uid || !data.currentRound) return;
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
    const code = roomIdRef.current;
    const data = roomRef.current;
    if (!code || !data || !uid || !data.currentRound) return;
    const r = data.currentRound;
    try {
      await set(ref(db, `rooms/${code}/answers/${r.roundIndex}/${uid}`), {
        formula: 'PASS',
        submittedAt: serverTimestamp(),
        adjustedElapsedMs: 0,
        passed: true,
      });
    } catch {
      /* noop */
    }
  }, [uid]);

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
        { formula: string; adjustedElapsedMs: number; passed?: boolean }
      >;
      const correct = Object.entries(answers)
        .filter(([, a]) => !a.passed)
        .sort((a, b) => a[1].adjustedElapsedMs - b[1].adjustedElapsedMs);

      const maxRank = settings.scoringMode === 'first' ? 1 : (settings.maxRankCount || 3);
      const results: Record<
        string,
        { adjustedElapsedMs: number; formula: string; gained: number; rank: number }
      > = {};

      for (let i = 0; i < correct.length; i++) {
        const [pUid, a] = correct[i];
        const rank = i + 1;
        const gained = getRankPoints(rank, maxRank, settings.scoringMode);
        results[pUid] = {
          adjustedElapsedMs: a.adjustedElapsedMs,
          formula: a.formula,
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
    await startRound(r.roundIndex + 1, matchStartIndex, settings);
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
    }
    if (!isGM || !room || !roomId) return;

    if (room.status !== 'playing' || !room.currentRound) {
      clearTimer('timeup');
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
      finalizeRound(correctIds.length > 0 ? 'answered' : 'passed');
      return;
    }

    // 3) 時間切れ監視（制限時間ありの場合のみ）
    if (!settings.unlimitedTime && !timersRef.current['timeup']) {
      const remain = r.startedAt + settings.timeLimitSec * 1000 - serverNow();
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
    joinRoom,
    leaveRoom,
    setReady,
    updateSettings,
    startMatch,
    submitAnswer,
    passRound,
    nextRound,
    backToLobby,
  };
}

export type UseRoom = ReturnType<typeof useRoom>;
