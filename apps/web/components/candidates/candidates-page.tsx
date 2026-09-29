'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, Filter, RefreshCw, Search, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CandidateListItem, CandidateRecord, ParallaxApiError, parallaxApi } from '../../lib/parallax-api';
import { spectralMetrics } from '../../lib/explanations';

type FilterKey = 'all' | 'new' | 'motion' | 'brightness' | 'spectral' | 'uncertain' | 'review' | 'artifact';
type FilterItem = { key: FilterKey; label: string };

const FILTERS: FilterItem[] = [
  { key: 'all', label: 'All evidence' },
  { key: 'new', label: 'New' },
  { key: 'motion', label: 'High apparent motion' },
  { key: 'brightness', label: 'Brightness change' },
  { key: 'spectral', label: 'Spectral change' },
  { key: 'uncertain', label: 'Uncertain' },
  { key: 'review', label: 'Needs review' },
  { key: 'artifact', label: 'Likely artifact' },
];

function metric(record: CandidateRecord | undefined, name: string) {
  return record?.measurements.find((item) => item.metricName === name)?.value ?? null;
}

function arrayMetric(record: CandidateRecord | undefined, name: string) {
  const value = record?.measurements.find((item) => item.metricName === name)?.metadata;
  return Array.isArray(value) && value.every((item) => typeof item === 'number') ? value as number[] : null;
}

function matchesFilter(candidate: CandidateListItem, record: CandidateRecord | undefined, filter: FilterKey) {
  if (filter === 'all') return true;
  if (filter === 'new') return candidate.status === 'candidate';
  if (filter === 'motion') {
    const displacement = arrayMetric(record, 'measurement.displacement_arcsec_xy');
    return candidate.classification === 'apparent_motion' && Boolean(displacement && Math.hypot(displacement[0], displacement[1]) >= 1);
  }
  if (filter === 'brightness') return candidate.classification === 'brightness_change';
  if (filter === 'spectral') return Boolean(record?.spectrum && (spectralMetrics(record.spectrum)?.normalizedDelta ?? 0) >= 0.05);
  if (filter === 'uncertain') return candidate.classification === 'uncertain';
  if (filter === 'review') return candidate.status === 'needs_review';
  return candidate.classification === 'likely_artifact';
}

export function CandidatesPage() {
  const [candidates, setCandidates] = useState<CandidateListItem[]>([]);
  const [records, setRecords] = useState<Record<string, CandidateRecord>>({});
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setOffline(false);
    try {
      const nextCandidates = await parallaxApi.listCandidates();
      const entries = await Promise.all(nextCandidates.map(async (candidate) => [candidate.id, await parallaxApi.getRecord(candidate.id)] as const));
      setCandidates(nextCandidates);
      setRecords(Object.fromEntries(entries));
    } catch (caught) {
      setError(caught instanceof ParallaxApiError ? caught.message : caught instanceof Error ? caught.message : 'The candidate queue could not be loaded.');
      setOffline(caught instanceof TypeError || (caught instanceof ParallaxApiError && caught.status >= 500));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const runDemo = async () => {
    setLoading(true);
    setError(null);
    try {
      await parallaxApi.runDemo();
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The demonstration analysis could not be started.');
      setLoading(false);
    }
  };

  const visible = useMemo(() => candidates.filter((candidate) => {
    const record = records[candidate.id];
    const textMatch = `${candidate.candidateKey} ${candidate.classification} ${candidate.interpretation}`.toLowerCase().includes(query.toLowerCase());
    return textMatch && matchesFilter(candidate, record, filter);
  }), [candidates, filter, query, records]);

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[var(--void)]">
      <div className="observatory-grid mx-auto min-h-[calc(100vh-72px)] max-w-[1440px] px-5 py-10 sm:px-8 lg:px-12">
        <header className="flex flex-col gap-6 border-b border-[var(--line)] pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="eyebrow">02 / Sky Mysteries</p><h1 className="mt-4 max-w-3xl text-4xl font-medium tracking-[-.06em] text-[var(--ink)] sm:text-5xl">Investigate what moved, changed, or resisted explanation.</h1><p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--muted)]">A queue of measurement-backed candidates. Every row keeps its classification, quality metrics, interpretation, and provenance attached.</p></div>
          <Link href="/explore" className="focus-ring inline-flex w-fit items-center gap-2 rounded-full bg-[var(--signal)] px-4 py-3 mono text-[10px] uppercase tracking-[.12em] text-[var(--void)]"><ArrowUpRight size={14} /> Return to observatory</Link>
        </header>

        <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex flex-wrap items-center gap-2"><Filter size={14} className="mr-1 text-[var(--cyan)]" />{FILTERS.map((item) => <button key={item.key} type="button" onClick={() => setFilter(item.key)} className={`focus-ring rounded-full border px-3 py-2 mono text-[9px] uppercase tracking-[.1em] transition-colors ${filter === item.key ? 'border-[var(--signal)] bg-[var(--signal-soft)] text-[var(--signal)]' : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'}`}>{item.label}</button>)}</div><label className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2"><Search size={14} className="text-[var(--quiet)]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search candidate evidence" className="w-full bg-transparent text-xs text-[var(--ink)] outline-none placeholder:text-[var(--quiet)] sm:w-56" aria-label="Search candidate evidence" /></label></div>

        <div className="mt-8 flex items-center justify-between border-b border-[var(--line)] pb-3 mono text-[9px] uppercase tracking-[.12em] text-[var(--quiet)]"><span>{visible.length} of {candidates.length} records · no composite ranking</span><button type="button" onClick={() => void load()} className="focus-ring inline-flex items-center gap-2 hover:text-[var(--signal)]"><RefreshCw size={12} /> Refresh evidence</button></div>

        {loading && <div className="panel mt-5 grid min-h-[300px] place-items-center"><div className="text-center"><Sparkles className="mx-auto text-[var(--signal)]" size={22} /><p className="eyebrow mt-4">Reading candidate records</p><p className="mt-3 text-sm text-[var(--muted)]">Loading stored measurements, spectra, and provenance.</p></div></div>}
        {!loading && error && <div className="panel mt-5 grid min-h-[300px] place-items-center px-6 text-center"><AlertTriangle className="text-[var(--amber)]" size={24} /><p className="eyebrow mt-4 text-[var(--amber)]">{offline ? 'Observatory offline' : 'Queue unavailable'}</p><p className="mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">{error}</p><div className="mt-5 flex flex-wrap justify-center gap-3"><button type="button" onClick={() => void runDemo()} className="focus-ring rounded-full bg-[var(--signal)] px-4 py-3 mono text-[10px] uppercase tracking-[.12em] text-[var(--void)]">Load demonstration dataset</button><button type="button" onClick={() => void load()} className="focus-ring rounded-full border border-[var(--line-strong)] px-4 py-3 mono text-[10px] uppercase tracking-[.12em] text-[var(--muted)]">Retry</button></div></div>}
        {!loading && !error && !candidates.length && <div className="panel mt-5 grid min-h-[300px] place-items-center px-6 text-center"><p className="eyebrow">No evidence loaded</p><p className="mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">The queue remains empty until the explicitly labeled demonstration analysis is persisted.</p><button type="button" onClick={() => void runDemo()} className="focus-ring mt-5 rounded-full bg-[var(--signal)] px-4 py-3 mono text-[10px] uppercase tracking-[.12em] text-[var(--void)]">Load demonstration dataset</button></div>}
        {!loading && !error && candidates.length > 0 && <div className="mt-5 space-y-3">{visible.map((candidate) => <CandidateRow key={candidate.id} candidate={candidate} record={records[candidate.id]} />)}{!visible.length && <div className="panel p-8 text-center"><p className="eyebrow">No matching records</p><p className="mt-3 text-sm text-[var(--muted)]">This filter does not match the stored candidate evidence.</p></div>}</div>}

        <p className="mt-8 max-w-3xl mono text-[9px] uppercase leading-5 tracking-[.1em] text-[var(--quiet)]">Prioritization uses explicit labels and component measurements only. PARALLAX does not collapse evidence into an unsupported probability score.</p>
      </div>
    </main>
  );
}

function CandidateRow({ candidate, record }: { candidate: CandidateListItem; record?: CandidateRecord }) {
  const displacement = arrayMetric(record, 'measurement.displacement_arcsec_xy');
  const deltaFlux = metric(record, 'measurement.delta_flux');
  const spectrum = spectralMetrics(record?.spectrum ?? null);
  const quality = metric(record, 'quality.component_snr');
  return <article className="panel group transition-colors hover:border-[var(--line-strong)]"><div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-center md:p-6"><div><div className="flex flex-wrap items-center gap-3"><span className="mono text-[11px] uppercase tracking-[.14em] text-[var(--signal)]">{candidate.candidateKey}</span><span className="rounded-full border border-[var(--line)] px-2 py-1 mono text-[8px] uppercase tracking-[.1em] text-[var(--quiet)]">{candidate.status}</span><span className="text-xs capitalize text-[var(--muted)]">{candidate.classification.replaceAll('_', ' ')}</span></div><h2 className="mt-3 text-lg font-medium tracking-[-.03em] text-[var(--ink)]">{candidate.interpretation}</h2><p className="mt-2 max-w-2xl text-xs leading-6 text-[var(--muted)]">{record?.detail.datasetLabel ?? 'DEMONSTRATION DATASET'} · measurement-backed review record</p></div><div className="grid grid-cols-2 gap-3 text-xs"><MiniMetric label="Motion" value={displacement ? `${Math.hypot(displacement[0], displacement[1]).toFixed(2)} arcsec` : '—'} /><MiniMetric label="Δ flux" value={deltaFlux === null ? '—' : deltaFlux.toFixed(2)} /><MiniMetric label="Spectrum" value={spectrum ? spectrum.normalizedDelta.toFixed(3) : '—'} /><MiniMetric label="SNR" value={quality === null ? '—' : quality.toFixed(2)} /></div><Link href={`/candidates/${candidate.id}`} className="focus-ring inline-flex items-center justify-center gap-2 rounded-full border border-[var(--line-strong)] px-4 py-2.5 mono text-[9px] uppercase tracking-[.1em] text-[var(--muted)] hover:border-[var(--signal)] hover:text-[var(--signal)]">Investigate <ArrowUpRight size={13} /></Link></div></article>;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div><p className="mono text-[8px] uppercase tracking-[.1em] text-[var(--quiet)]">{label}</p><p className="mt-1 text-[var(--ink)]">{value}</p></div>;
}
