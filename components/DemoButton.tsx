import type { ButtonHTMLAttributes } from 'react';

type DemoButtonTone = 'emerald' | 'sky' | 'zinc' | 'red';
type DemoButtonVariant = 'solid' | 'outline' | 'link';
type DemoButtonStrength = 'base' | 'strong';
type DemoButtonSize = 'medium' | 'small';

const SIZE_CLASSNAME: Record<DemoButtonSize, string> = {
  medium: 'px-4 py-3 text-sm font-semibold',
  small: 'px-4 py-2 text-xs font-semibold uppercase tracking-widest',
} as const;

const LINK_SIZE_CLASSNAME: Record<DemoButtonSize, string> = {
  medium: 'text-sm font-semibold',
  small: 'text-xs font-semibold uppercase tracking-widest',
} as const;

const FOCUS_RING_CLASSNAME: Record<DemoButtonTone, string> = {
  emerald: 'focus-visible:outline-emerald-400',
  sky: 'focus-visible:outline-sky-400',
  zinc: 'focus-visible:outline-zinc-500',
  red: 'focus-visible:outline-red-400',
} as const;

const SOLID_STYLES: Record<
  DemoButtonTone,
  Record<DemoButtonStrength, string>
> = {
  emerald: {
    base: 'bg-emerald-400 text-emerald-950 hover:bg-emerald-300 disabled:bg-emerald-400/50',
    strong: 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400 disabled:bg-emerald-500/40',
  },
  sky: {
    base: 'bg-sky-400 text-sky-950 hover:bg-sky-300 disabled:bg-sky-400/50',
    strong: 'bg-sky-500 text-sky-950 hover:bg-sky-400 disabled:bg-sky-500/40',
  },
  zinc: {
    base: 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 disabled:bg-zinc-800/60',
    strong: 'bg-zinc-900 text-zinc-100 hover:bg-zinc-800 disabled:bg-zinc-900/70',
  },
  red: {
    base: 'bg-red-500 text-red-950 hover:bg-red-400 disabled:bg-red-500/50',
    strong: 'bg-red-600 text-red-950 hover:bg-red-500 disabled:bg-red-600/50',
  },
} as const;

const OUTLINE_STYLES: Record<
  DemoButtonTone,
  Record<DemoButtonStrength, string>
> = {
  emerald: {
    base: 'border border-emerald-300/40 bg-transparent text-emerald-200 hover:border-emerald-200 disabled:border-emerald-300/20 disabled:text-emerald-200/60',
    strong: 'border border-emerald-100/30 bg-transparent text-emerald-50 hover:border-emerald-100 disabled:border-emerald-100/20 disabled:text-emerald-100/60',
  },
  sky: {
    base: 'border border-sky-400/40 bg-transparent text-sky-200 hover:border-sky-300 disabled:border-sky-400/20 disabled:text-sky-200/60',
    strong: 'border border-sky-400/40 bg-transparent text-sky-100 hover:border-sky-300 disabled:border-sky-400/20 disabled:text-sky-100/60',
  },
  zinc: {
    base: 'border border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500 disabled:border-zinc-700 disabled:text-zinc-400 disabled:bg-zinc-900/80',
    strong: 'border border-zinc-600 bg-zinc-900 text-zinc-100 hover:border-zinc-500 disabled:border-zinc-700 disabled:text-zinc-300 disabled:bg-zinc-900/80',
  },
  red: {
    base: 'border border-red-400 bg-transparent text-red-300 hover:border-red-300 hover:text-red-200 disabled:border-red-400/40 disabled:text-red-300/60',
    strong: 'border border-red-300 bg-transparent text-red-200 hover:border-red-200 hover:text-red-100 disabled:border-red-300/40 disabled:text-red-200/60',
  },
} as const;

const LINK_STYLES: Record<DemoButtonTone, string> = {
  emerald: 'text-emerald-300 hover:text-emerald-200 disabled:text-emerald-300/60',
  sky: 'text-sky-300 hover:text-sky-200 disabled:text-sky-300/60',
  zinc: 'text-zinc-500 hover:text-zinc-300 disabled:text-zinc-500/60',
  red: 'text-red-300 hover:text-red-200 disabled:text-red-300/60',
} as const;

interface DemoButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly tone: DemoButtonTone;
  readonly variant?: DemoButtonVariant;
  readonly strength?: DemoButtonStrength;
  readonly size?: DemoButtonSize;
  readonly fullWidth?: boolean;
  readonly elevated?: boolean;
}

export function DemoButton({
  tone,
  variant = 'solid',
  strength = 'base',
  size = 'medium',
  fullWidth = false,
  elevated = false,
  className,
  type = 'button',
  ...props
}: DemoButtonProps) {
  const focusClass = FOCUS_RING_CLASSNAME[tone];
  const baseClassName = [
    'inline-flex items-center justify-center rounded-lg transition duration-150 ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed',
    focusClass,
    fullWidth ? 'w-full' : undefined,
    variant === 'link' ? LINK_SIZE_CLASSNAME[size] : SIZE_CLASSNAME[size],
  ];

  const variantClassName = getVariantClasses(variant, tone, strength, elevated);

  const mergedClassName = [...baseClassName, variantClassName, className].filter(Boolean).join(' ');

  return <button type={type} className={mergedClassName} {...props} />;
}

function getVariantClasses(
  variant: DemoButtonVariant,
  tone: DemoButtonTone,
  strength: DemoButtonStrength,
  elevated: boolean,
): string {
  if (variant === 'solid') {
    const classes = [SOLID_STYLES[tone][strength]];
    if (elevated && tone === 'emerald') {
      classes.push('shadow-lg shadow-emerald-500/30');
    }
    return classes.join(' ');
  }

  if (variant === 'outline') {
    return OUTLINE_STYLES[tone][strength];
  }

  return LINK_STYLES[tone];
}
