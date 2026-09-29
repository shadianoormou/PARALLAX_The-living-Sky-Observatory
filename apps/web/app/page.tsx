'use client';

import Link from 'next/link';
import { ArrowDown, ArrowUpRight, Pause, Play } from 'lucide-react';
import { useState } from 'react';

export default function HomePage() {
  const [introVisible, setIntroVisible] = useState(true);
  const [playing, setPlaying] = useState(true);

  return (
    <section className="hero-glow relative min-h-[calc(100vh-72px)] overflow-hidden bg-[var(--void)]">
      <div className="star-field" aria-hidden="true" />
      <div className="observatory-grid absolute inset-0 opacity-50" aria-hidden="true" />
      <div className="absolute left-[7%] top-[21%] h-48 w-48 rounded-full border border-[rgba(141,229,226,.16)] sm:h-72 sm:w-72" aria-hidden="true" />
      <div className="absolute left-[12%] top-[28%] h-32 w-32 rounded-full border border-[rgba(200,255,107,.12)] sm:h-48 sm:w-48" aria-hidden="true" />
      <div className="absolute right-[8%] top-[18%] hidden h-px w-40 bg-[var(--line-strong)] sm:block" aria-hidden="true" />
      <div className="relative mx-auto flex min-h-[calc(100vh-72px)] max-w-[1440px] flex-col justify-between px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
        <div className="flex items-center justify-between">
          <p className="eyebrow">A public observatory for repeated skies</p>
          <button type="button" className="focus-ring mono hidden items-center gap-2 text-[10px] uppercase tracking-[.15em] text-[var(--muted)] hover:text-[var(--signal)] sm:flex" onClick={() => setIntroVisible(false)}>
            Skip intro <ArrowUpRight size={13} />
          </button>
        </div>

        <div className="relative py-16 sm:py-24">
          <p className="mb-6 max-w-sm text-sm leading-6 text-[var(--muted)]">A living record of what moves, brightens, fades, and waits for a second look.</p>
          <h1 className="max-w-5xl text-[clamp(3.8rem,11vw,10.5rem)] font-medium leading-[.83] tracking-[-.08em] text-[var(--ink)]">
            <span className="block">The sky is not</span>
            <span className="block text-[var(--signal)]">a picture.</span>
            <span className="mt-4 block text-[clamp(2.5rem,7vw,7rem)] text-[var(--muted)]">It is a movie.</span>
          </h1>
          <div className="mt-12 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
            <Link href="/explore" className="focus-ring inline-flex w-fit items-center gap-3 rounded-full bg-[var(--signal)] px-6 py-4 mono text-[10px] font-medium uppercase tracking-[.15em] text-[var(--void)] transition-transform hover:-translate-y-1">
              Enter the living sky <ArrowUpRight size={15} />
            </Link>
            <Link href="/architecture" className="focus-ring inline-flex w-fit items-center gap-2 mono text-[10px] uppercase tracking-[.15em] text-[var(--muted)] hover:text-[var(--ink)]">
              How PARALLAX works <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-5 border-t border-[var(--line)] pt-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-4">
            <button type="button" aria-label={playing ? 'Pause atmosphere' : 'Play atmosphere'} onClick={() => setPlaying((value) => !value)} className="focus-ring rounded-full border border-[var(--line-strong)] p-2 text-[var(--muted)] hover:text-[var(--signal)]">
              {playing ? <Pause size={13} /> : <Play size={13} />}
            </button>
            <p className="mono text-[9px] uppercase tracking-[.14em] text-[var(--quiet)]">Procedural atmosphere / decorative only</p>
          </div>
          <div className="flex items-center gap-3 text-[var(--quiet)]">
            <span className="mono text-[10px] uppercase tracking-[.15em]">Scroll to orient</span>
            <ArrowDown size={14} />
          </div>
        </div>
      </div>
      {introVisible && <span className="sr-only">Intro active. Skip intro is available above.</span>}
    </section>
  );
}
