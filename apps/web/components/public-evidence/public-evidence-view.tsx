'use client';

import Link from 'next/link';
import { AlertTriangle, Clock3, LockKeyhole } from 'lucide-react';
import { useEffect, useState } from 'react';
import { JsonObject, PublicEvidenceBundle, parallaxApi } from '../../lib/parallax-api';

function objectValue(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null && key in value ? (value as JsonObject)[key] : undefined;
}

export function PublicEvidenceView({ id }: { id: string }) {
  const [bundle, setBundle] = useState<PublicEvidenceBundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void parallaxApi.getPublicEvidenceBundle(id).then(setBundle).catch((caught) => setError(caught instanceof Error ? caught.message : 'This public evidence bundle is unavailable.'));
  }, [id]);

  if (error) return <section className="panel border-[var(--amber)]/40 p-6"><div className="flex items-start gap-3"><AlertTriangle className="text-[var(--amber)]" size={20} /><div><h2 className="text-lg text-[var(--ink)]">Evidence link unavailable</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{error} Public bundles are immutable and expire automatically.</p></div></div></section>;
  if (!bundle) return <section className="panel p-6 text-sm text-[var(--muted)]" aria-live="polite">Loading read-only evidence…</section>;

  const payload = bundle.payload;
  const report = objectValue(payload, 'report');
  const summary = objectValue(report, 'summary');
  const target = objectValue(report, 'target');
  const status = objectValue(summary, 'consistency_status');

  return <div className="space-y-6">
    <section className="panel border-[var(--cyan)]/35 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow text-[var(--cyan)]">PUBLIC READ-ONLY EVIDENCE BUNDLE</p><h2 className="mt-3 text-2xl font-medium text-[var(--ink)]">{bundle.title}</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">This link is a frozen evidence handoff. It contains no reviewer controls and cannot be edited from the public view.</p></div><LockKeyhole className="text-[var(--cyan)]" size={22} aria-label="Read-only bundle" /> </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3"><Info label="Bundle ID" value={bundle.bundleId.slice(0, 12)} /><Info label="Created" value={new Date(bundle.createdAtUtc).toLocaleString()} /><Info label="Expires" value={new Date(bundle.expiresAtUtc).toLocaleString()} /></div>
    </section>
    <section className="grid gap-4 sm:grid-cols-3"><Info label="Decision status" value={typeof status === 'string' ? status.replaceAll('_', ' ') : 'Evidence available'} /><Info label="Target" value={target && typeof objectValue(target, 'ra_deg') === 'number' && typeof objectValue(target, 'dec_deg') === 'number' ? `RA ${objectValue(target, 'ra_deg')}° · Dec ${objectValue(target, 'dec_deg')}°` : 'Archive target recorded'} /><Info label="Review mode" value="Public / read-only" /></section>
    <section className="panel p-6"><div className="flex items-center gap-2"><Clock3 size={16} className="text-[var(--signal)]" /><h2 className="text-lg text-[var(--ink)]">Machine-readable payload</h2></div><pre className="mt-4 max-h-[560px] overflow-auto border border-[var(--line)] bg-[var(--surface-2)] p-4 text-xs leading-6 text-[var(--muted)]" tabIndex={0}>{JSON.stringify(payload, null, 2)}</pre><Link href="/parallax-x" className="focus-ring mt-5 inline-flex border border-[var(--line-strong)] px-4 py-3 mono text-[9px] uppercase tracking-[.1em] text-[var(--cyan)]">Open live evidence desk</Link></section>
  </div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="border border-[var(--line)] bg-[var(--surface-2)] p-4"><p className="mono text-[9px] uppercase tracking-[.1em] text-[var(--quiet)]">{label}</p><p className="mt-2 break-words text-sm text-[var(--ink)]">{value}</p></div>;
}
