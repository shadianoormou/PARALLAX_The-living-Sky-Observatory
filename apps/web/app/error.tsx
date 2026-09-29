'use client';

import Link from 'next/link';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="observatory-grid min-h-[calc(100vh-72px)] px-5 py-24 sm:px-8 lg:px-12"><div className="mx-auto max-w-[1440px]"><p className="eyebrow">Signal interrupted</p><h1 className="mt-6 max-w-xl text-5xl font-medium tracking-[-.06em] text-[var(--ink)]">The observatory lost its thread.</h1><p className="mt-5 max-w-lg text-sm leading-7 text-[var(--muted)]">This interface is safe to retry. No scientific state has been changed.</p><div className="mt-10 flex gap-6"><button type="button" onClick={() => reset()} className="focus-ring rounded-full bg-[var(--signal)] px-5 py-3 mono text-[10px] uppercase tracking-[.12em] text-[var(--void)]">Try again</button><Link href="/" className="focus-ring py-3 mono text-[10px] uppercase tracking-[.12em] text-[var(--muted)]">Return home</Link></div></div></section>;
}
