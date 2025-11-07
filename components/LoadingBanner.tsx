'use client';

export function LoadingBanner() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 text-center text-zinc-300">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
      <p className="text-lg font-medium tracking-wide">Preparing subscription demo…</p>
    </div>
  );
}
