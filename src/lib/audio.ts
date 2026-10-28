/**
 * サウンドエンジン（BGM / SE）
 *
 * - 音源はすべて CC0（パブリックドメイン）の外部アセット。
 *   BGM: Komiku（Game Music Pack / chosic.com 収録・CC0）
 *   SE : Kenney.nl "Audio Pack"（CC0）
 *   実体は public/audio/ に置き、必要なときに遅延読み込みする（本体のJSを軽く保つ）
 * - ブラウザの自動再生制限があるため、最初のユーザー操作（タップ/キー）で unlock する。
 * - ON/OFF と音量は localStorage に保存され、全画面で共有される。
 */
// サブディレクトリ配信でも壊れないよう、HTML の位置からの相対URLで解決する
const AUDIO_BASE =
  typeof document !== 'undefined'
    ? new URL('audio/', document.baseURI).href
    : `${import.meta.env.BASE_URL}audio/`;

export type BgmName = 'menu' | 'battle' | 'result';

export type SeName =
  | 'ui'
  | 'hover'
  | 'toggle'
  | 'tile'
  | 'op'
  | 'calc'
  | 'correct'
  | 'wrong'
  | 'tick'
  | 'go'
  | 'roundEnd'
  | 'finish'
  | 'chatSend'
  | 'chatRecv'
  | 'join'
  | 'leave'
  | 'start'
  | 'pass'
  | 'laser';

const BGM_SRC: Record<BgmName, string> = {
  menu: `${AUDIO_BASE}bgm/menu.mp3`,
  battle: `${AUDIO_BASE}bgm/battle.mp3`,
  result: `${AUDIO_BASE}bgm/result.mp3`,
};

const SE_SRC: Record<SeName, string> = {
  ui: `${AUDIO_BASE}se/ui_click.mp3`,
  hover: `${AUDIO_BASE}se/ui_hover.mp3`,
  toggle: `${AUDIO_BASE}se/ui_toggle.mp3`,
  tile: `${AUDIO_BASE}se/tile_select.mp3`,
  op: `${AUDIO_BASE}se/op_select.mp3`,
  calc: `${AUDIO_BASE}se/calc.mp3`,
  correct: `${AUDIO_BASE}se/correct.mp3`,
  wrong: `${AUDIO_BASE}se/wrong.mp3`,
  tick: `${AUDIO_BASE}se/tick.mp3`,
  go: `${AUDIO_BASE}se/go.mp3`,
  roundEnd: `${AUDIO_BASE}se/round_end.mp3`,
  finish: `${AUDIO_BASE}se/finish.mp3`,
  chatSend: `${AUDIO_BASE}se/chat_send.mp3`,
  chatRecv: `${AUDIO_BASE}se/chat_recv.mp3`,
  join: `${AUDIO_BASE}se/join.mp3`,
  leave: `${AUDIO_BASE}se/leave.mp3`,
  start: `${AUDIO_BASE}se/start.mp3`,
  pass: `${AUDIO_BASE}se/pass.mp3`,
  laser: `${AUDIO_BASE}se/laser.mp3`,
};

/** unlock 直後に先読みしておく効果音（よく使うものだけ） */
const PRELOAD_SE: SeName[] = ['ui', 'toggle', 'tile', 'op', 'correct', 'wrong', 'tick', 'chatRecv'];

/**
 * SE ごとの音量バランス。
 * 音源側をピーク -1.2dB 前後に揃えてあるので、ここでは「出しゃばり具合」だけを調整する。
 */
const SE_GAIN: Record<SeName, number> = {
  tile: 0.85,
  op: 0.8,
  calc: 0.9,
  correct: 1,
  wrong: 0.9,
  tick: 0.6,
  go: 1,
  roundEnd: 0.95,
  finish: 1,
  chatSend: 0.6,
  chatRecv: 0.55,
  join: 0.7,
  leave: 0.6,
  start: 0.95,
  pass: 0.6,
  ui: 0.55,
  hover: 0.3,
  toggle: 0.6,
  laser: 0.55,
};

export interface SoundSettings {
  bgm: boolean;
  se: boolean;
  bgmVolume: number;
  seVolume: number;
}

const STORAGE_KEY = 'make10.audio';
/** 保存フォーマットのバージョン（音量の既定値を変えたら上げる） */
const STORAGE_VERSION = 2;

const DEFAULT_STATE: SoundSettings = {
  bgm: true,
  se: true,
  bgmVolume: 0.75,
  seVolume: 0.85,
};

/** 既定音量を上げた際の移行用（旧既定値のままの人だけ新しい既定値へ寄せる） */
const LEGACY_DEFAULTS = { bgmVolume: 0.45, seVolume: 0.7 };

function loadState(): SoundSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as
      | Partial<SoundSettings>
      | null;
    if (!raw) return { ...DEFAULT_STATE };
    const legacy = (raw as { v?: number }).v !== STORAGE_VERSION;
    const bgmVolume = clamp01(raw.bgmVolume ?? DEFAULT_STATE.bgmVolume);
    const seVolume = clamp01(raw.seVolume ?? DEFAULT_STATE.seVolume);
    return {
      bgm: typeof raw.bgm === 'boolean' ? raw.bgm : DEFAULT_STATE.bgm,
      se: typeof raw.se === 'boolean' ? raw.se : DEFAULT_STATE.se,
      // 旧既定のまま触っていない人だけ、新しい（大きめの）既定音量へ移行する
      bgmVolume: legacy && bgmVolume === LEGACY_DEFAULTS.bgmVolume ? DEFAULT_STATE.bgmVolume : bgmVolume,
      seVolume: legacy && seVolume === LEGACY_DEFAULTS.seVolume ? DEFAULT_STATE.seVolume : seVolume,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
}

let state: SoundSettings = typeof window === 'undefined' ? { ...DEFAULT_STATE } : loadState();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, v: STORAGE_VERSION }));
  } catch {
    /* 保存できなくても動作に影響なし */
  }
}

function update(patch: Partial<SoundSettings>) {
  state = { ...state, ...patch };
  persist();
  emit();
  if (!state.bgm) stopBgmNow();
  else if (pendingBgm) startBgmNow(pendingBgm);
  applyBgmVolume();
}

export function getSoundSettings(): SoundSettings {
  return state;
}

export function subscribeSoundSettings(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function setBgmEnabled(on: boolean) {
  update({ bgm: on });
}

export function setSeEnabled(on: boolean) {
  update({ se: on });
}

export function setBgmVolume(v: number) {
  update({ bgmVolume: clamp01(v) });
}

export function setSeVolume(v: number) {
  update({ seVolume: clamp01(v) });
}

/* ============================ SE ============================ */

const seCache = new Map<SeName, HTMLAudioElement>();
let unlocked = false;

function makeSe(name: SeName) {
  let base = seCache.get(name);
  if (!base) {
    base = new Audio(SE_SRC[name]);
    base.preload = 'auto';
    seCache.set(name, base);
  }
  return base;
}

export function playSe(name: SeName) {
  if (!state.se || state.seVolume <= 0) return;
  try {
    const base = makeSe(name);
    // 連打しても重ならないよう、clone して再生する
    const el = base.cloneNode(true) as HTMLAudioElement;
    el.volume = clamp01(state.seVolume * (SE_GAIN[name] ?? 0.7));
    void el.play().catch(() => undefined);
    el.addEventListener('ended', () => el.remove(), { once: true });
  } catch {
    /* 再生できなくてもゲーム進行には影響しない */
  }
}

/* ============================ BGM ============================ */

let bgmEl: HTMLAudioElement | null = null;
let currentBgm: BgmName | null = null;
let pendingBgm: BgmName | null = null;
let fadeTimer: ReturnType<typeof setInterval> | null = null;

function clearFade() {
  if (fadeTimer) clearInterval(fadeTimer);
  fadeTimer = null;
}

function fadeTo(el: HTMLAudioElement, target: number, ms: number, onDone?: () => void) {
  const from = el.volume;
  const steps = Math.max(1, Math.round(ms / 40));
  let i = 0;
  const timer = setInterval(() => {
    i += 1;
    const t = i / steps;
    el.volume = clamp01(from + (target - from) * t);
    if (i >= steps) {
      clearInterval(timer);
      if (fadeTimer === timer) fadeTimer = null;
      onDone?.();
    }
  }, 40);
  fadeTimer = timer;
}

function bgmTargetVolume() {
  return clamp01(state.bgmVolume);
}

function applyBgmVolume() {
  if (!bgmEl) return;
  if (!state.bgm) return;
  bgmEl.volume = bgmTargetVolume();
}

function startBgmNow(name: BgmName) {
  if (!state.bgm) return;
  if (currentBgm === name && bgmEl) {
    void bgmEl.play().catch(() => undefined);
    return;
  }
  clearFade();
  const old = bgmEl;
  if (old) {
    fadeTo(old, 0, 500, () => old.pause());
  }
  const el = new Audio(BGM_SRC[name]);
  el.loop = true;
  el.preload = 'auto';
  el.volume = 0;
  bgmEl = el;
  currentBgm = name;
  void el.play().catch(() => undefined);
  fadeTo(el, bgmTargetVolume(), 900);
}

function stopBgmNow() {
  clearFade();
  const old = bgmEl;
  bgmEl = null;
  currentBgm = null;
  if (old) {
    fadeTo(old, 0, 420, () => old.pause());
  }
}

/**
 * BGM を切り替える。まだユーザー操作がない場合は予約だけしておき、
 * unlock() が呼ばれたタイミングで再生を開始する。
 */
export function setBgm(name: BgmName | null) {
  pendingBgm = name;
  if (!name) {
    stopBgmNow();
    return;
  }
  if (!state.bgm) return;
  if (!unlocked) return;
  startBgmNow(name);
}

export function getCurrentBgm(): BgmName | null {
  return currentBgm;
}

/** 最初のユーザー操作で呼ぶ（自動再生制限の解除） */
export function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  // 無音の短い再生でオーディオコンテキストを起こす
  try {
    const primer = new Audio(SE_SRC.ui);
    primer.volume = 0;
    void primer.play().catch(() => undefined);
  } catch {
    /* noop */
  }
  for (const name of PRELOAD_SE) makeSe(name);
  if (pendingBgm && state.bgm) startBgmNow(pendingBgm);
}

/** タブが戻ってきたときに BGM が止まっていたら再開する */
export function resumeBgmIfNeeded() {
  if (!state.bgm || !bgmEl) return;
  if (bgmEl.paused) void bgmEl.play().catch(() => undefined);
}
