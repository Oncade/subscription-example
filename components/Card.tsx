import type { PropsWithChildren } from 'react';

type CardPadding = 'compact' | 'default' | 'none';
type CardElement = 'article' | 'aside' | 'div' | 'section';

const CARD_PADDING_CLASSNAME: Record<CardPadding, string> = {
  compact: 'p-6',
  default: 'p-8',
  none: 'p-0',
} as const;

interface CardProps {
  readonly as?: CardElement;
  readonly className?: string;
  readonly padding?: CardPadding;
}

export function Card({
  as: Component = 'div',
  children,
  className,
  padding = 'default',
}: PropsWithChildren<CardProps>) {
  const baseClassName = 'rounded-3xl border border-zinc-800 bg-zinc-900/70 shadow-lg shadow-emerald-500/10 backdrop-blur';

  const hasShadowOverride =
    className !== undefined &&
    /\bshadow(?:-none|\b|-)/.test(className);

  const resolvedBase = hasShadowOverride ? baseClassName.replace('shadow-lg shadow-emerald-500/10', '').replace(/\s{2,}/g, ' ').trim() : baseClassName;
  const rootClassName = [resolvedBase, CARD_PADDING_CLASSNAME[padding], className].filter(Boolean).join(' ');

  return <Component className={rootClassName}>{children}</Component>;
}
