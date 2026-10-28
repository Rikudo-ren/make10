import type { ReactNode, SVGProps } from 'react';

/**
 * 絵文字のかわりに使うラインアイコン集。
 * すべて currentColor / stroke ベースなので、ネオンの文字色にそのまま追従する。
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 18, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function IconVolumeOn(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 9.5h3.2L12 5.6v12.8L7.2 14.5H4z" />
      <path d="M15.4 8.6a4.6 4.6 0 0 1 0 6.8" />
      <path d="M18.2 6a8 8 0 0 1 0 12" />
    </Svg>
  );
}

export function IconVolumeOff(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 9.5h3.2L12 5.6v12.8L7.2 14.5H4z" />
      <path d="M16 9.5l5 5M21 9.5l-5 5" />
    </Svg>
  );
}

export function IconEqualizer(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 20V9M12 20V4M19 20v-7" />
      <circle cx="5" cy="6.5" r="1.6" />
      <circle cx="12" cy="17.5" r="1.6" />
      <circle cx="19" cy="10" r="1.6" />
    </Svg>
  );
}

export function IconClose(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

export function IconCheck(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4.5 12.5l4.5 4.5L19.5 6.5" />
    </Svg>
  );
}

export function IconCopy(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="9" y="9" width="10" height="10" rx="1.5" />
      <path d="M15 6.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v8.5A1.5 1.5 0 0 0 5 15h1.5" />
    </Svg>
  );
}

export function IconCrown(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 8l4 3 5-6 5 6 4-3-1.7 10.5H4.7z" />
      <path d="M4.7 21h14.6" />
    </Svg>
  );
}

export function IconTrophy(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M7 4h10v4.5a5 5 0 0 1-10 0z" />
      <path d="M7 5.5H4.2V7A3.2 3.2 0 0 0 7 10.2M17 5.5h2.8V7a3.2 3.2 0 0 1-2.8 3.2" />
      <path d="M12 13.5V17M8.5 20.5h7M10 17h4l.7 3.5h-5.4z" />
    </Svg>
  );
}

export function IconBolt(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M13.5 2.5L5.5 13.2h5l-1 8.3 8-11.1h-5z" />
    </Svg>
  );
}

export function IconTarget(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="4.4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconUsers(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M16.2 6.2a3 3 0 0 1 0 5.8M17.5 14.8c2 .5 3.3 2.2 3.3 4.7" />
    </Svg>
  );
}

export function IconComms(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 5.5h16v10.5H12l-4.6 3.2v-3.2H4z" />
      <path d="M8.2 9.3h7.6M8.2 12.4h4.6" />
    </Svg>
  );
}

export function IconSend(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3.5 12L20.5 4.5 14 20.5l-3-6.5z" />
      <path d="M11 14l4-4" />
    </Svg>
  );
}

export function IconUndo(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8.5 6.5L4 11l4.5 4.5" />
      <path d="M4 11h9.5a6 6 0 0 1 0 12H10" />
    </Svg>
  );
}

export function IconRedo(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M15.5 6.5L20 11l-4.5 4.5" />
      <path d="M20 11h-9.5a6 6 0 0 0 0 12H14" />
    </Svg>
  );
}

export function IconReset(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 3.5V8h-4.5" />
    </Svg>
  );
}

export function IconSkip(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 6l8 6-8 6z" />
      <path d="M18 6v12" />
    </Svg>
  );
}

export function IconPlay(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M7 4.8l12 7.2-12 7.2z" />
    </Svg>
  );
}

export function IconLock(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="4.8" y="10.5" width="14.4" height="9.5" rx="1.4" />
      <path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" />
    </Svg>
  );
}

export function IconAlert(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3.8L21.2 20H2.8z" />
      <path d="M12 9.5v4.6M12 17.2v.2" />
    </Svg>
  );
}

export function IconSpark(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3l2.2 5.6L20 10.8l-5.8 2.2L12 18.6l-2.2-5.6L4 10.8l5.8-2.2z" />
    </Svg>
  );
}

export function IconArrowRight(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4.5 12h14M13 6.5l5.5 5.5-5.5 5.5" />
    </Svg>
  );
}

export function IconGear(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v2.4M12 18.8v2.4M4.5 7.5l2 1.2M17.5 15.3l2 1.2M4.5 16.5l2-1.2M17.5 8.7l2-1.2" />
    </Svg>
  );
}

export function IconGlobe(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.4 3.6 5.4 3.6 8.5S14.4 18.1 12 20.5c-2.4-2.4-3.6-5.4-3.6-8.5S9.6 5.9 12 3.5z" />
    </Svg>
  );
}

export function IconGrid(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3.5" y="3.5" width="7" height="7" />
      <rect x="13.5" y="3.5" width="7" height="7" />
      <rect x="3.5" y="13.5" width="7" height="7" />
      <rect x="13.5" y="13.5" width="7" height="7" />
    </Svg>
  );
}
