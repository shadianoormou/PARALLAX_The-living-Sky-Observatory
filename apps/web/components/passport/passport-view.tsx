'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Passport, parallaxApi } from '../../lib/parallax-api';

const metrics: [keyof Passport, string][] = [
  ['objectsInspected', 'Objects inspected'],
  ['candidatesReviewed', 'Candidates reviewed'],
  ['regionsExplored', 'Regions explored'],
  ['consensusMatches', 'Consensus matches'],
  ['artifactsIdentified', 'Artifacts identified'],
  ['learningModulesCompleted', 'Learning modules completed'],
];

export function PassportView() {
  const [passport, setPassport] = useState<Passport | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void parallaxApi.getPassport().then(setPassport).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Passport could not be loaded.')); }, []);
  if (error) return <div className="panel p-8 text-sm text-[var(--amber)]">{error}</div>;
  if (!passport) return <div className="panel p-8 text-sm text-[var(--muted)]">Reading your observatory record…</div>;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-4"><span className="mono border border-[var(--line)] px-3 py-2 text-[10px] uppercase tracking-[.12em] text-[var(--amber)]">DEMONSTRATION DATASET</span><Link className="text-xs uppercase tracking-[.14em] text-[var(--cyan)]" href="/citizen-science">Review another candidate →</Link></div>
    <div className="grid gap-px border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-3">{metrics.map(([key, label]) => <div key={key} className="bg-[var(--surface)] p-6"><p className="eyebrow">{label}</p><p className="mt-8 text-4xl font-medium text-[var(--ink)]">{passport[key] as number}</p></div>)}</div>
    <div className="panel p-6 sm:p-8"><p className="eyebrow">Achievements</p>{passport.achievements.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2">{passport.achievements.map((achievement) => <div key={achievement.key} className="border-l-2 border-[var(--signal)] pl-4"><p className="mono text-xs text-[var(--signal)]">{achievement.name}</p><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{achievement.description}</p></div>)}</div> : <p className="mt-5 text-sm leading-7 text-[var(--muted)]">Achievements appear quietly as your review record grows. There are no points, streaks, or rankings here.</p>}</div>
  </div>;
}
