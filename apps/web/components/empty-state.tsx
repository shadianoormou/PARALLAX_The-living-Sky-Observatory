import { ArrowUpRight, CircleDashed } from 'lucide-react';
import Link from 'next/link';

export function EmptyState({ eyebrow = 'Observatory boundary', title, body, href = '/science', linkLabel = 'Read the methodology' }: { eyebrow?: string; title: string; body: string; href?: string; linkLabel?: string }) {
  return (
    <div className="panel relative overflow-hidden p-7 sm:p-10">
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full border border-[var(--line)] opacity-60" />
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full border border-[var(--line)] opacity-40" />
      <CircleDashed className="mb-8 text-[var(--signal)]" size={22} strokeWidth={1.25} />
      <p className="eyebrow mb-4">{eyebrow}</p>
      <h2 className="max-w-xl text-2xl font-medium tracking-[-.03em] text-[var(--ink)] sm:text-3xl">{title}</h2>
      <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--muted)]">{body}</p>
      <Link href={href} className="focus-ring mt-7 inline-flex items-center gap-2 border-b border-[var(--signal)] pb-1 mono text-[10px] uppercase tracking-[.12em] text-[var(--signal)] hover:border-[var(--ink)] hover:text-[var(--ink)]">
        {linkLabel} <ArrowUpRight size={14} />
      </Link>
    </div>
  );
}
