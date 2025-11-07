import { Badge } from './Badge';

interface PreviewBadgeProps {
  readonly className?: string;
}

export function PreviewBadge({ className }: PreviewBadgeProps) {
  const rootClassName = ['uppercase tracking-widest', className].filter(Boolean).join(' ');
  return (
    <Badge tone="emerald" variant="outline" className={rootClassName}>
      Partner preview
    </Badge>
  );
}
