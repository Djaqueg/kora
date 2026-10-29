import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props,
  };
}

export function IconLibrary(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 8H20" />
    </svg>
  );
}

export function IconCards(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="6" width="13" height="14" rx="2" />
      <path d="M8 4h11a2 2 0 0 1 2 2v11" />
    </svg>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M4.9 6.5l1.6 1.6M17.5 15.9l1.6 1.6M3 12h2.2M18.8 12H21M4.9 17.5l1.6-1.6M17.5 8.1l1.6-1.6" />
    </svg>
  );
}

export function IconBack(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M15 5 8 12l7 7" />
    </svg>
  );
}

export function IconPlay(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconPause(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function IconHeadphones(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 13a8 8 0 0 1 16 0" />
      <path d="M4 13v5a2 2 0 0 0 2 2h1v-7H6a2 2 0 0 0-2 2zM20 13v5a2 2 0 0 1-2 2h-1v-7h1a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function IconSpark(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3l1.6 5.2L19 10l-5.4 1.8L12 17l-1.6-5.2L5 10l5.4-1.8z" />
    </svg>
  );
}

export function IconStar({ filled, ...props }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.7 14.05 8.7l5.45.48-4.15 3.58 1.28 5.34L12 15.7 7.37 18.1l1.28-5.34L4.5 9.18l5.45-.48Z" fill={filled ? 'currentColor' : 'none'} />
    </svg>
  );
}

export function IconHeart({ filled, ...props }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base(props)}>
      <path d="M12 19.2s-6.4-4-6.4-8.2a3.55 3.55 0 0 1 6.4-2.1 3.55 3.55 0 0 1 6.4 2.1c0 4.2-6.4 8.2-6.4 8.2z" fill={filled ? 'currentColor' : 'none'} />
    </svg>
  );
}

export function IconDownload(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4.5v9" />
      <path d="m8.2 10.2 3.8 3.8 3.8-3.8" />
      <path d="M5.5 18.5h13" />
    </svg>
  );
}

export function IconBookOpen(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 6.2C9.7 4.9 7.2 4.5 4.5 5v11.6c2.7-.4 5.2 0 7.5 1.3 2.3-1.3 4.8-1.7 7.5-1.3V5c-2.7-.5-5.2-.1-7.5 1.2z" />
      <path d="M12 6.2v11.7" />
    </svg>
  );
}

export function IconMoon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M15.8 3.6A7.2 7.2 0 1 0 20.4 14 5.9 5.9 0 0 1 15.8 3.6z" />
    </svg>
  );
}

export function IconSun(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3.4" />
      <path d="M12 3.2v1.8M12 19v1.8M4.8 12H3M21 12h-1.8M6.2 6.2 7.5 7.5M16.5 16.5l1.3 1.3M17.8 6.2 16.5 7.5M7.5 16.5 6.2 17.8" />
    </svg>
  );
}

export function IconBookmark(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 4.2h10a1 1 0 0 1 1 1V20l-6-3.1L6 20V5.2a1 1 0 0 1 1-1z" />
    </svg>
  );
}

export function IconBluetooth(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m7.2 7.2 9.6 9.6L12 21.2V2.8l4.8 4.4L7.2 16.8" />
    </svg>
  );
}

export function IconSliders(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 8h16M4 16h16" />
      <circle cx="9" cy="8" r="2.1" fill="var(--paper, #fff)" />
      <circle cx="15" cy="16" r="2.1" fill="var(--paper, #fff)" />
    </svg>
  );
}
