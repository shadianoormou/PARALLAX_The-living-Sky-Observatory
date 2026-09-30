'use client';

import { AlertTriangle, Check, Network, RefreshCw, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { ParallaxApiError, SpherexEvidenceGraph, parallaxApi } from '../../lib/parallax-api';

const BAND_OPTIONS = ['SPHEREx-D3', 'SPHEREx-D4', 'SPHEREx-D5', 'SPHEREx-D6'];

export function EvidenceGraphView() {
  const [ra, setRa] = useState('127.69444');
  const [dec, setDec] = useState('-39.1776');
  const [bands, setBands] = useState(['SPHEREx-D3', 'SPHEREx-D4', 'SPHEREx-D5']);
  const [report, setReport] = useState<SpherexEvidenceGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleBand(band: string) {
    setBands((current) => current.includes(band) ? current.filter((item) => item !== band) : [...current, band]);
  }

  async function run() {
    if (bands.length < 2) {
      setError('Select at least two SPHEREx bands so the evidence chain has a comparison context.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setReport(await parallaxApi.evidenceGraphSpherex({ ra_deg: Number(ra), dec_deg: Number(dec), bands }));
    } catch (caught) {
      setError(caught instanceof ParallaxApiError ? caught.message : caught instanceof Error ? caught.message : 'The evidence graph is unavailable.');
    } finally {
      setLoading(false);
    }
  }

  return <div className="space-y-6">
    <section className="panel border-[var(--cyan)]/30 p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-2xl">
          <p className="eyebrow text-[var(--cyan)]">MULTI-BAND EVIDENCE GRAPH</p>
          <h2 className="mt-3 text-2xl font-medium tracking-[-.03em] text-[var(--ink)]">Follow one target through the archive.</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">PARALLAX X keeps each wavelength independent, then joins the provenance into one review chain. A weak band stays visible as weak evidence; it is never averaged into confidence.</p>
        </div>
        <div className="flex items-center gap-2 border border-[var(--cyan)]/30 px-3 py-2 mono text-[9px] uppercase tracking-[.12em] text-[var(--cyan)]"><Network size={13} /> Evidence, not certainty</div>
      </div>
      <div className="mt-7 grid gap-4 md:grid-cols-[1fr_1fr_2fr_auto] md:items-end">
        <Field label="Right ascension (deg)" value={ra} onChange={setRa} />
        <Field label="Declination (deg)" value={dec} onChange={setDec} />
        <div>
          <p className="mono mb-2 text-[9px] uppercase tracking-[.1em] text-[var(--quiet)]">Bands / minimum two</p>
          <div className="flex flex-wrap gap-2">
            {BAND_OPTIONS.map((band) => <label key={band} className={`inline-flex cursor-pointer items-center gap-2 border px-3 py-2 mono text-[9px] uppercase tracking-[.08em] ${bands.includes(band) ? 'border-[var(--signal)]/50 bg-[var(--signal-soft)] text-[var(--signal)]' : 'border-[var(--line)] text-[var(--quiet)]'}`}><input className="sr-only" type="checkbox" checked={bands.includes(band)} onChange={() => toggleBand(band)} />{band.replace('SPHEREx-', '')}</label>)}
          </div>
        </div>
        <button type="button" onClick={() => void run()} disabled={loading} className="focus-ring inline-flex items-center justify-center gap-2 bg-[var(--signal)] px-5 py-3 mono text-[10px] uppercase tracking-[.12em] text-[var(--void)] disabled:opacity-50"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} />{loading ? 'Reading archive…' : 'Build graph'}</button>
      </div>
      {error && <p className="mt-5 border border-[var(--amber)]/40 p-4 text-xs leading-6 text-[var(--amber)]">{error}</p>}
    </section>

    {!report && !loading && <section className="grid gap-4 md:grid-cols-3"><InfoCard label="1 / Query" text="One sky position, repeated across selected SPHEREx bands." /><InfoCard label="2 / Gate" text="Every epoch pair is checked for dimensions, flags, overlap, and registration." /><InfoCard label="3 / Review" text="The result preserves provenance, screened residuals, and honest null results." /></section>}
    {loading && <div className="panel p-8 text-sm text-[var(--muted)]">Discovering public IRSA products and measuring each selected band independently…</div>}
    {report && <Report report={report} />}
  </div>;
}

function Report({ report }: { report: SpherexEvidenceGraph }) {
  const summary = report.summary;
  return <div className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Metric label="Bands" value={String(summary.bands_requested)} tone="cyan" /><Metric label="Ready" value={String(summary.bands_ready)} tone="signal" /><Metric label="Caution / blocked" value={`${summary.bands_caution} / ${summary.bands_blocked}`} tone={summary.bands_blocked ? 'amber' : 'cyan'} /><Metric label="Errors" value={String(summary.bands_error)} tone={summary.bands_error ? 'amber' : 'signal'} /><Metric label="Candidates" value={String(summary.total_candidates)} tone="signal" /></div>
    <section className="panel p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">TARGET EVIDENCE CHAIN</p><h2 className="mt-3 text-xl font-medium text-[var(--ink)]">{report.target.ra_deg.toFixed(5)}°, {report.target.dec_deg.toFixed(5)}°</h2></div><span className="mono border border-[var(--line)] px-3 py-2 text-[9px] uppercase tracking-[.1em] text-[var(--quiet)]">{report.graph.nodes.length} nodes / {report.graph.edges.length} links</span></div>
      <div className="mt-6 space-y-3">{report.bands.map((item) => <BandCard key={item.band} item={item} />)}</div>
    </section>
    <section className="border-t border-[var(--line)] pt-6"><p className="eyebrow">Interpretation boundary</p><p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)]">This graph makes the evidence auditable across bands. It does not turn agreement into a probability of discovery, and it does not claim that a null result rules out a real object.</p><ul className="mt-4 space-y-2 text-xs leading-6 text-[var(--quiet)]">{report.limitations.map((item) => <li key={item}>· {item}</li>)}</ul></section>
  </div>;
}

function BandCard({ item }: { item: SpherexEvidenceGraph['bands'][number] }) {
  const blocked = item.status === 'COMPARISON NOT RELIABLE' || item.status === 'ERROR';
  const ready = item.status === 'READY TO COMPARE';
  const quality = item.quality;
  const valid = Array.isArray(quality.valid_pixel_fraction) ? quality.valid_pixel_fraction.map((value) => typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '—').join(' / ') : '—';
  return <article className="border border-[var(--line)] bg-[var(--surface-2)] p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="mono text-[10px] uppercase tracking-[.12em] text-[var(--cyan)]">{item.band}</p><h3 className="mt-2 text-lg text-[var(--ink)]">{item.candidate_count ? `${item.candidate_count} promoted candidate(s)` : 'Null result / no promoted residual'}</h3></div><span className={`inline-flex items-center gap-1.5 border px-2.5 py-1 mono text-[9px] uppercase tracking-[.08em] ${ready ? 'border-[var(--signal)]/40 text-[var(--signal)]' : blocked ? 'border-[var(--amber)]/40 text-[var(--amber)]' : 'border-[var(--cyan)]/40 text-[var(--cyan)]'}`}>{ready ? <Check size={12} /> : blocked ? <AlertTriangle size={12} /> : <ShieldCheck size={12} />}{item.status}</span></div><div className="mt-4 grid gap-3 text-xs sm:grid-cols-3"><Data label="Epoch chain" value={item.epochs.length ? item.epochs.join(' → ') : item.error ?? 'No usable pair'} /><Data label="Valid pixels" value={valid} /><Data label="Screened" value={String(item.screened_count)} /></div>{item.candidate_count === 0 && <p className="mt-4 text-xs leading-6 text-[var(--quiet)]">Measured, reviewed, and retained as a null result for this band—not evidence that the sky is empty.</p>}{item.error && <p className="mt-4 text-xs leading-6 text-[var(--amber)]">{item.error}</p>}</article>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label><span className="mono mb-2 block text-[9px] uppercase tracking-[.1em] text-[var(--quiet)]">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className="focus-ring w-full border border-[var(--line-strong)] bg-[var(--surface-2)] px-3 py-3 text-sm text-[var(--ink)]" inputMode="decimal" /></label>; }
function InfoCard({ label, text }: { label: string; text: string }) { return <div className="panel p-5"><p className="eyebrow text-[var(--cyan)]">{label}</p><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{text}</p></div>; }
function Metric({ label, value, tone }: { label: string; value: string; tone: 'signal' | 'cyan' | 'amber' }) { const color = tone === 'signal' ? 'var(--signal)' : tone === 'cyan' ? 'var(--cyan)' : 'var(--amber)'; return <div className="panel p-4" style={{ borderTopColor: color }}><p className="mono text-[9px] uppercase tracking-[.1em] text-[var(--quiet)]">{label}</p><p className="mt-3 text-2xl font-medium" style={{ color }}>{value}</p></div>; }
function Data({ label, value }: { label: string; value: string }) { return <div className="border border-[var(--line)] p-3"><p className="mono text-[9px] uppercase tracking-[.08em] text-[var(--quiet)]">{label}</p><p className="mt-2 break-words text-xs leading-5 text-[var(--muted)]">{value}</p></div>; }
