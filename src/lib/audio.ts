/**
 * サウンドエンジン（BGM / SE）
 *
 * - 音源はすべて CC0（パブリックドメイン）の外部アセットを同梱しています。
 *   BGM: FreePD.com (CC0) / SE: Kenney.nl "Audio Pack" (CC0)
 * - ブラウザの自動再生制限があるため、最初のユーザー操作（タップ/キー）で unlock します。
 * - ON/OFF と音量は localStorage に保存され、全画面で共有されます。
 */
import menuBgm from '../assets/audio/bgm/menu.mp3';
import battleBgm from '../assets/audio/bgm/battle.mp3';
import resultBgm from '../assets/audio/bgm/result.mp3';

import seCalc from '../assets/audio/se/calc.mp3';
import seChatRecv from '../assets/audio/se/chat_recv.mp3';
import seChatSend from '../assets/audio/se/chat_send.mp3';
import seCorrect from '../assets/audio/se/correct.mp3';
import seFinish from '../assets/audio/se/finish.mp3';
import seGo from '../assets/audio/se/go.mp3';
import seJoin from '../assets/audio/se/join.mp3';
import seLaser from '../assets/audio/se/laser.mp3';
import seLeave from '../assets/audio/se/leave.mp3';
import seOp from '../assets/audio/se/op_select.mp3';
import sePass from '../assets/audio/se/pass.mp3';
import seRoundEnd from '../assets/audio/se/round_end.mp3';
import seStart from '../assets/audio/se/start.mp3';
import seTick from '../assets/audio/se/tick.mp3';
import seTile from '../assets/audio/se/tile_select.mp3';
import seUi from '../assets/audio/se/ui_click.mp3';
import seHover from '../assets/audio/se/ui_hover.mp3';
import seToggle from '../assets/audio/se/ui_toggle.mp3';
import seWrong from '../assets/audio/se/wrong.mp3';

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
  menu: menuBgm,
  battle: battleBgm,
  result: resultBgm,
};

const SE_SRC: Record<SeName, string> = {
  ui: seUi,
  hover: seHover,
  toggle: seToggle,
  tile: seTile,
  op: seOp,
  calc: seCalc,
  correct: seCorrect,
  wrong: seWrong,
  tick: seTick,
  go: seGo,
  roundEnd: seRoundEnd,
  finish: seFinish,
  chatSend: seChatSend,
  chatRecv: seChatRecv,
  join: seJoin,
  leave: seLeave,
  start: seStart,
  pass: sePass,
  laser: seLaser,
};

/** SE ごとの音量バランス（聞こえ方を揃える） */
const SE_GAIN: Record<SeName, number> = {
  tile: 0.7,
  op: 0.6,
  calc: 0.8,
  correct: 0.9,
  wrong: 0.8,
  tick: 0.5,
  go: 0.9,
  roundEnd: 0.85,
  finish: 1,
  chatSend: 0.55,
  chatRecv: 0.5,
  join: 0.6,
  leave: 0.55,
  start: 0.85,
  pass: 0.55,
  ui: 0.5,
  hover: 0.28,
  toggle: 0.55,
  laser: 0.5,
};

export interface SoundSettings {
  bgm: boolean;
  se: boolean;
  bgmVolume: number;
  seVolume: number;
}

const STORAGE_KEY = 'make10.audio';

const DEFAULT_STATE: SoundSettings = {
  bgm: true,
  se: true,
  bgmVolume: 0.45,
  seVolume: 0.7,
};

function loadState(): SoundSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as
      | Partial<SoundSettings>
      | null;
    if (!raw) return { ...DEFAULT_STATE };
    return {
      bgm: typeof raw.bgm === 'boolean' ? raw.bgm : DEFAULT_STATE.bgm,
      se: typeof raw.se === 'boolean' ? raw.se : DEFAULT_STATE.se,
      bgmVolume: clamp01(raw.bgmVolume ?? DEFAULT_STATE.bgmVolume),
      seVolume: clamp01(raw.seVolume ?? DEFAULT_STATE.seVolume),
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
  return clamp01(state.bgmVolume) * 0.9;
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
  for (const name of Object.keys(SE_SRC) as SeName[]) makeSe(name);
  if (pendingBgm && state.bgm) startBgmNow(pendingBgm);
}

/** タブが戻ってきたときに BGM が止まっていたら再開する */
export function resumeBgmIfNeeded() {
  if (!state.bgm || !bgmEl) return;
  if (bgmEl.paused) void bgmEl.play().catch(() => undefined);
}
