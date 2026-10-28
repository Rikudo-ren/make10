/**
 * ルームの後片付けロジック（DOM/React 非依存の純粋関数）
 *
 * - 24時間アクセスが無いルームは期限切れで削除
 * - **誰も入っていない（在室プレイヤーが0人の）ルームは、作成直後の猶予を除いて即削除**
 *
 * Realtime Database にはサーバー側のTTLや条件付き削除が無いため、
 * クライアント（アプリを開いている人）が rooms/index を見て掃除する。
 */

/** ルーム（スコア・履歴・解答・チャット）の保存期間 */
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * 誰もいないルームを消すまでの猶予。
 * ルーム作成直後（index 登録の前後）に取りこぼさないためのバッファ。
 */
export const EMPTY_ROOM_GRACE_MS = 15 * 1000;

/** 掃除の実行間隔（アプリを開いている間だけ動く） */
export const SWEEP_INTERVAL_MS = 15 * 1000;

/** 1回の掃除で在室チェックするルームの上限（読み取り回数の上限） */
export const MAX_EMPTY_CHECKS = 12;

/** 在室ハートビートの間隔（タブを開いている間だけ送る） */
export const HEARTBEAT_MS = 15 * 1000;

/** ハートビートを書き込む最小間隔（連続操作時もこの間隔まで間引く） */
export const TOUCH_THROTTLE_MS = 15 * 1000;

/**
 * 「最近アクセスがあった＝誰かが居る」とみなすしきい値。
 * ハートビート(15秒)の2回分。ここで true になった部屋は「在室確認をしない」だけなので、
 * 判定が早すぎても「消してはいけない部屋を消す」ことは起きない（読み取りが増えるだけ）。
 */
export const RECENT_ACTIVITY_MS = 30 * 1000;

/**
 * rooms/index/{code} の中身。
 * 期限と作成時刻だけを持つ軽量エントリ。
 */
export interface RoomIndexEntry {
  expiresAt?: number;
  createdAt?: number;
}

/** 掃除の判定結果 */
export type SweepAction =
  /** 何もしない */
  | 'keep'
  /** 期限切れ → ルームごと削除 */
  | 'delete'
  /** 期限情報の無いゴミ → インデックスから落とす */
  | 'drop-index'
  /** 在室者がいるか確認する（いなければ削除） */
  | 'check-empty';

/**
 * インデックスの1エントリについて、次に何をすべきか決める。
 * 在室確認（'check-empty'）は読み取りが増えるので、呼び出し側で上限をかけること。
 */
export function decideSweep(
  entry: RoomIndexEntry | null | undefined,
  now: number,
): SweepAction {
  if (!entry || typeof entry !== 'object') return 'drop-index';
  const exp = entry.expiresAt;
  if (typeof exp !== 'number' || !Number.isFinite(exp)) return 'drop-index';
  if (exp <= now) return 'delete';
  return 'check-empty';
}

/**
 * 在室者が1人でもいるか。
 * presence は onDisconnect で name を消す実装なので、
 * 「name が入っているプレイヤーが1人もいない」＝誰もいない部屋とみなす。
 */
export function hasAnyPlayer(players: unknown): boolean {
  if (!players || typeof players !== 'object') return false;
  for (const raw of Object.values(players as Record<string, unknown>)) {
    const name = (raw as { name?: unknown } | null | undefined)?.name;
    if (typeof name === 'string' && name.trim().length > 0) return true;
  }
  return false;
}

/**
 * 最近アクセスがあったか（＝誰かのタブが開いていてハートビートを送っている可能性が高い）。
 * true なら在室確認をスキップしてよい（消してはいけない側に倒す）。
 */
export function isRecentlyActive(
  entry: RoomIndexEntry | null | undefined,
  now: number,
  ttlMs: number = ROOM_TTL_MS,
  recentMs: number = RECENT_ACTIVITY_MS,
): boolean {
  const exp = entry?.expiresAt;
  if (typeof exp !== 'number' || !Number.isFinite(exp)) return false;
  const lastTouch = exp - ttlMs;
  return now - lastTouch < recentMs;
}

/**
 * 作成直後のルームか？（在室者がまだ書き込まれていない瞬間を消さないための猶予判定）
 * createdAt が無い古いルームは「古い」とみなす。
 */
export function isFreshRoom(
  entry: RoomIndexEntry | null | undefined,
  now: number,
  graceMs: number = EMPTY_ROOM_GRACE_MS,
): boolean {
  const created = entry?.createdAt;
  if (typeof created !== 'number' || !Number.isFinite(created)) return false;
  return now - created < graceMs;
}

/** rooms/index 全体（コード → 期限） */
export type RoomIndex = Record<string, RoomIndexEntry>;

export interface SweepIO {
  /** 現在時刻（サーバー時刻オフセット補正済み） */
  now: number;
  /** rooms/index を読む */
  readIndex: () => Promise<RoomIndex>;
  /** rooms/{code}/players を読む */
  readPlayers: (code: string) => Promise<unknown>;
  /** 削除・掃除をまとめて適用する（値 null = 削除） */
  apply: (updates: Record<string, number | null>) => Promise<void>;
  /** 1回で在室確認するルーム数の上限 */
  maxChecks?: number;
}

export interface SweepResult {
  /** 削除したルームコード */
  deleted: string[];
  /** 在室確認したルームコード */
  checked: string[];
}

/**
 * 1回分の掃除を実行する。
 *
 * - 期限切れ（24時間）→ ルームごと削除
 * - 期限情報の無いインデックス → インデックスだけ削除（ゴミ掃除）
 * - 在室者が0人 → ルームごと削除（作成からEMPTY_ROOM_GRACE_MS以内のものは除く）
 * - 最近ハートビートの来ている部屋 → 何もしない（誰かが居る）
 */
export async function sweepOnce(io: SweepIO): Promise<SweepResult> {
  const maxChecks = io.maxChecks ?? MAX_EMPTY_CHECKS;
  const index = await io.readIndex();
  const updates: Record<string, number | null> = {};
  const deleted: string[] = [];
  const checked: string[] = [];
  let checks = 0;

  for (const [code, entry] of Object.entries(index ?? {})) {
    const action = decideSweep(entry, io.now);
    if (action === 'drop-index') {
      updates[`rooms/index/${code}`] = null;
      continue;
    }
    if (action === 'delete') {
      updates[`rooms/${code}`] = null;
      updates[`rooms/index/${code}`] = null;
      deleted.push(code);
      continue;
    }
    // 最近ハートビートが来ている部屋＝誰かが居るので在室確認しない
    if (isRecentlyActive(entry, io.now)) continue;
    if (checks >= maxChecks) continue;
    checks += 1;
    checked.push(code);

    const players = await io.readPlayers(code);
    if (hasAnyPlayer(players)) continue;
    if (isFreshRoom(entry, io.now)) continue;
    updates[`rooms/${code}`] = null;
    updates[`rooms/index/${code}`] = null;
    deleted.push(code);
  }

  if (Object.keys(updates).length > 0) await io.apply(updates);
  return { deleted, checked };
}
