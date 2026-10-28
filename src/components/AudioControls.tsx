import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  getSoundSettings,
  playSe,
  setBgmEnabled,
  setBgmVolume,
  setSeEnabled,
  setSeVolume,
  subscribeSoundSettings,
  type SoundSettings,
} from '../lib/audio';
import { IconClose, IconEqualizer, IconVolumeOff, IconVolumeOn } from './icons';
import { cn } from '../utils/cn';

export function useSoundSettings(): SoundSettings {
  return useSyncExternalStore(subscribeSoundSettings, getSoundSettings, getSoundSettings);
}

function Slider({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <input
      type="range"
      min={0}
      max={100}
      step={1}
      value={Math.round(value * 100)}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => onChange(Number(e.target.value) / 100)}
      className="range w-full"
    />
  );
}

function Switch({
  on,
  onChange,
  label,
  onClickSound,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  onClickSound?: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => {
        onClickSound?.();
        onChange(!on);
      }}
      className={cn(
        'relative h-6 w-12 shrink-0 border transition-all duration-200',
        on
          ? 'border-cyan-300/80 bg-cyan-400/25 shadow-[0_0_18px_-4px_rgba(34,224,255,.9)]'
          : 'border-white/20 bg-white/5',
      )}
      style={{ clipPath: 'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)' }}
    >
      <span
        className={cn(
          'absolute top-[3px] h-[16px] w-[16px] transition-all duration-200',
          on ? 'left-[26px] bg-cyan-200 shadow-[0_0_12px_rgba(34,224,255,.9)]' : 'left-[3px] bg-slate-400',
        )}
      />
    </button>
  );
}

/**
 * BGM / SE の ON・OFF と音量を切り替えるフローティングパネル。
 * 端末ごとの設定（localStorage）なので、全員の画面に影響はしない。
 *
 * `screenKey`（トップ / ひとり練習 / ルームID + ステータス）が変わったら
 * パネルを自動的に閉じる。ボタン自体は常に残す（毎回開き直せるように）。
 */
export function AudioControls({ screenKey }: { screenKey?: string }) {
  const s = useSoundSettings();
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState(true);

  const wrapRef = useRef<HTMLDivElement | null>(null);

  // 画面が切り替わったら開きっぱなしのパネルを閉じる（初回マウント時は除く）
  const lastScreen = useRef(screenKey);
  useEffect(() => {
    if (lastScreen.current === screenKey) return;
    lastScreen.current = screenKey;
    setOpen(false);
  }, [screenKey]);

  // パネルの外側をタップ／Esc でも閉じられるようにする
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // 最初のうちだけ「音が鳴ります」のヒントを出す
  useEffect(() => {
    const t = setTimeout(() => setHint(false), 6000);
    return () => clearTimeout(t);
  }, []);

  const muted = !s.bgm && !s.se;

  return (
    <div
      ref={wrapRef}
      className="fixed right-3 bottom-3 z-[95] flex flex-col items-end gap-2 print:hidden"
    >
      {open && (
        <div className="card animate-float-up w-[268px] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="label flex items-center gap-2 text-cyan-200/80">
              <IconEqualizer size={13} />
              AUDIO SYSTEM
            </div>
            <button
              onClick={() => {
                playSe('ui');
                setOpen(false);
              }}
              className="text-slate-500 transition hover:text-cyan-200"
              aria-label="オーディオ設定を閉じる"
            >
              <IconClose size={14} />
            </button>
          </div>

          <div className="space-y-3.5">
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="jp text-[12px] font-bold text-slate-200">BGM</span>
                <Switch
                  on={s.bgm}
                  label="BGMのON/OFF"
                  onClickSound={() => playSe('toggle')}
                  onChange={(v) => setBgmEnabled(v)}
                />
              </div>
              <Slider
                value={s.bgmVolume}
                onChange={setBgmVolume}
                disabled={!s.bgm}
                label="BGMの音量"
              />
            </div>

            <div className="hairline" />

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="jp text-[12px] font-bold text-slate-200">
                  効果音
                  <span className="ml-1.5 text-[9px] font-normal text-slate-500">
                    （ONでBGMもON）
                  </span>
                </span>
                <Switch
                  on={s.se}
                  label="効果音のON/OFF"
                  onClickSound={() => playSe('toggle')}
                  onChange={(v) => {
                    setSeEnabled(v);
                    if (v) setTimeout(() => playSe('correct'), 60);
                  }}
                />
              </div>
              <Slider
                value={s.seVolume}
                onChange={(v) => {
                  setSeVolume(v);
                  playSe('tick');
                }}
                disabled={!s.se}
                label="効果音の音量"
              />
            </div>

          </div>

          <p className="mt-3 border-t border-white/10 pt-2 text-[9px] leading-relaxed text-slate-500">
            BGM: Komiku / SE: Kenney (Interface・Sci-Fi・Audio Pack) — すべて CC0
            <br />
            設定はこの端末に保存されます。
          </p>
        </div>
      )}

      <div className="flex items-center gap-2">
        {hint && !open && (
          <span
            className={cn(
              'animate-fade-in rounded-sm border px-2 py-1 text-[10px] tracking-wider',
              muted
                ? 'border-white/25 bg-black/70 text-slate-300'
                : 'border-cyan-300/30 bg-black/70 text-cyan-200/80',
            )}
          >
            {muted ? 'AUDIO OFF · TAP TO ENABLE' : 'AUDIO ON'}
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            playSe('ui');
            setOpen((v) => !v);
          }}
          aria-label="オーディオ設定を開く"
          aria-expanded={open}
          className={cn(
            'group relative grid h-12 w-12 place-items-center border transition-all',
            muted
              ? 'border-white/20 bg-black/60 text-slate-400'
              : 'border-cyan-300/50 bg-cyan-400/10 text-cyan-200 shadow-[0_0_26px_-8px_rgba(34,224,255,.9)]',
          )}
          style={{
            clipPath:
              'polygon(22% 0,100% 0,100% 78%,78% 100%,0 100%,0 22%)',
          }}
        >
          {muted ? <IconVolumeOff size={20} /> : <IconVolumeOn size={20} />}
          <span
            className={cn(
              'pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100',
              'bg-[radial-gradient(circle_at_50%_50%,rgba(34,224,255,.35),transparent_70%)]',
            )}
          />
        </button>
      </div>
    </div>
  );
}
