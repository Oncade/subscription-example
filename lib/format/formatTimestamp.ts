export function formatTimestamp(timestamp?: string): string {
  if (!timestamp) {
    return '—';
  }

  const date = new Date(timestamp);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

