import type { PropsWithChildren } from 'react';

export type BadgeTone = 'amber' | 'emerald' | 'red' | 'sky' | 'zinc';

const BADGE_TONE_STYLES: Record<
  BadgeTone,
  {
    readonly solid: string;
    readonly outline: string;
  }
> = {
  amber: {
    outline: 'border border-amber-400/40 bg-amber-400/10 text-amber-200',
    solid: 'bg-amber-400/15 text-amber-100',
  },
  emerald: {
    outline: 'border border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
    solid: 'bg-emerald-400/15 text-emerald-100',
  },
  red: {
    outline: 'border border-red-400/40 bg-red-400/10 text-red-200',
    solid: 'bg-red-400/15 text-red-100',
  },
  sky: {
    outline: 'border border-sky-400/40 bg-sky-400/10 text-sky-200',
    solid: 'bg-sky-400/15 text-sky-100',
  },
  zinc: {
    outline: 'border border-zinc-500/40 bg-zinc-500/10 text-zinc-200',
    solid: 'bg-zinc-500/10 text-zinc-100',
  },
} as const;

export interface BadgeProps {
  readonly tone: BadgeTone;
  readonly variant?: 'outline' | 'solid';
  readonly className?: string;
}

export function Badge({
  children,
  className,
  tone,
  variant = 'solid',
}: PropsWithChildren<BadgeProps>) {
  const toneStyles = BADGE_TONE_STYLES[tone][variant];
  const rootClassName = [
    'inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold',
    toneStyles,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <span className={rootClassName}>{children}</span>;
}
