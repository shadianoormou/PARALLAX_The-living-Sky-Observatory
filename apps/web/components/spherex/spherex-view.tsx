'use client';

import { AlertTriangle, Check, ExternalLink, LoaderCircle, Search } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { ParallaxApiError, SpherexArchiveAnalysis, SpherexArchiveRequest, SpherexArchiveSearch, parallaxApi } from '../../lib/parallax-api';

const DEFAULT_QUERY: SpherexArchiveRequest = {
  ra_deg: 127.69444,
  dec_deg: -39.1776,
  radius_deg: 0.001,
  collection: 'spherex_qr2',
  band: 'SPHEREx-D3',
  cutout_size_deg: 0.03,
  max_results: 20,
};

export function SpherexView() {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [search, setSearch] = useState<SpherexArchiveSearch | null>(null);
  const [analysis, setAnalysis] = useState<SpherexArchiveAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setAnalysis(null);
    try {
      const result = await parallaxApi.searchSpherex(query);
      setSearch(result);
      setAnalysis(await parallaxApi.analyzeSpherex(query));
    } catch (caught) {
      setError(caught instanceof ParallaxApiError ? caught.message : caught instanceof Error ? caught.message : 'The SPHEREx archive could not be reached.');
    } finally {
      setBusy(false);
    }
  }

  const update = (key: keyof SpherexArchiveRequest, value: string) => setQuery((current) => ({ ...current, [key]: key === 'collection' || key === 'band' ? value : Number(value) }));
  const comparison = analysis?.analysis.comparison;

  return <div className="space-y-6">
    <section className="panel p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">REAL NASA ARCHIVE</p><h2 className="mt-3 text-2xl font-medium tracking-[-.04em] text-[var(--ink)]">Search by sky position.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">The request goes to IRSA SIA, downloads bounded FITS cutouts, and preserves the archive URL, release metadata, timestamp, checksum, WCS, flags, and variance.</p></div><span className="mono border border-[var(--signal)]/30 bg-[var(--signal-soft)] px-3 py-2 text-[10px] uppercase tracking-[.12em] text-[var(--signal)]">SPHEREx / IRSA</span></div>
      <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="RA · degrees" value={query.ra_deg} onChange={(value) => update('ra_deg', value)} />
        <Field label="Dec · degrees" value={query.dec_deg} onChange={(value) => update('dec_deg', value)} />
        <Field label="Search radius · degrees" value={query.radius_deg} onChange={(value) => update('radius_deg', value)} />
        <Field label="Cutout size · degrees" value={query.cutout_size_deg} onChange={(value) => update('cutout_size_deg', value)} />
        <label className="block"><span className="eyebrow">Collection</span><select value={query.collection} onChange={(event) => update('collection', event.target.value)} className="focus-ring mt-2 w-full border border-[var(--line-strong)] bg-[var(--surface)] px-3 py-3 mono text-xs text-[var(--ink)]"><option>spherex_qr2</option><option>spherex_qr3</option></select></label>
        <Field label="Band" value={query.band ?? ''} onChange={(value) => update('band', value)} />
        <button type="submit" disabled={busy} className="focus-ring mt-5 inline-flex items-center justify-center gap-2 bg-[var(--signal)] px-4 py-3 mono text-[10px] font-medium uppercase tracking-[.14em] text-[var(--void)] disabled:opacity-50 sm:col-span-2"><Search size={14} /> {busy ? 'Querying archive…' : 'Search and compare'}</button>
      </form>
      {error && <p className="mt-5 border border-[var(--amber)]/40 bg-[rgba(243,187,113,.08)] p-4 text-sm leading-6 text-[var(--amber)]" role="alert"><AlertTriangle className="mr-2 inline" size={15} />{error}</p>}
    </section>

    {busy && <div className="panel flex items-center gap-3 p-6 text-sm text-[var(--muted)]"><LoaderCircle className="animate-spin" size={16} /> Checking archive products, reading FITS metadata, and running Comparison Guard…</div>}
    {search && <section className="space-y-3"><div className="flex items-center justify-between"><p className="eyebrow">ARCHIVE RESULTS · {search.records.length} products</p><span className="mono text-[10px] uppercase tracking-[.12em] text-[var(--quiet)]">source-backed</span></div>{search.records.slice(0, 8).map((record) => <article key={`${record.observation_id}-${record.band}`} className="panel flex flex-wrap items-center justify-between gap-4 p-4"><div><p className="mono text-xs text-[var(--ink)]">{record.observation_id} · {record.band}</p><p className="mt-2 text-xs text-[var(--muted)]">MJD {record.t_min_mjd.toFixed(5)} · {record.pixel_scale_arcsec.toFixed(2)} arcsec / px · {record.wavelength_um[0]?.toFixed(2)}–{record.wavelength_um[1]?.toFixed(2)} μm</p></div><a className="focus-ring inline-flex items-center gap-2 mono text-[10px] uppercase tracking-[.12em] text-[var(--cyan)]" href={record.access_url} target="_blank" rel="noreferrer">FITS source <ExternalLink size={12} /></a></article>)}</section>}
    {analysis && <AnalysisResult report={analysis} comparison={comparison} />}
  </div>;
}

function Field({ label, value, onChange }: { label: string; value: number | string; onChange: (value: string) => void }) {
  return <label className="block"><span className="eyebrow">{label}</span><input className="focus-ring mt-2 w-full border border-[var(--line-strong)] bg-[var(--surface)] px-3 py-3 mono text-xs text-[var(--ink)]" value={value} onChange={(event) => onChange(event.target.value)} inputMode="decimal" /></label>;
}

function AnalysisResult({ report, comparison }: { report: SpherexArchiveAnalysis; comparison?: SpherexArchiveAnalysis['analysis']['comparison'] }) {
  const draw = (canvas: HTMLCanvasElement | null, preview: SpherexArchiveAnalysis['previews']['a']) => {
    if (!canvas) return;
    canvas.width = preview.width; canvas.height = preview.height;
    const context = canvas.getContext('2d'); if (!context) return;
    const pixels = new Uint8ClampedArray(preview.pixels.flatMap((pixel) => [pixel, pixel, pixel, 255]));
    context.putImageData(new ImageData(pixels, preview.width, preview.height), 0, 0);
  };
  return <section className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><p className="eyebrow">MEASURED REAL-DATA RESULT</p><span className="mono border border-[var(--cyan)]/30 px-3 py-2 text-[10px] uppercase tracking-[.12em] text-[var(--cyan)]">{report.analysis.dataset_label}</span></div><div className="panel p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="eyebrow">COMPARISON GUARD</p><h2 className="mt-3 text-2xl font-medium tracking-[-.04em] text-[var(--ink)]">{comparison?.status}</h2></div>{comparison?.status === 'READY TO COMPARE' ? <Check className="text-[var(--signal)]" /> : <AlertTriangle className="text-[var(--amber)]" />}</div><p className="mt-4 text-sm leading-6 text-[var(--muted)]">{comparison?.reasons.join(' ')}</p>{comparison?.warnings.length ? <p className="mt-3 text-xs leading-6 text-[var(--amber)]">{comparison.warnings.join(' ')}</p> : null}</div><div className="grid gap-5 md:grid-cols-2"><Preview label="EPOCH A" preview={report.previews.a} draw={draw} /><Preview label="EPOCH B" preview={report.previews.b} draw={draw} /></div><div className="panel p-5"><p className="eyebrow">STRUCTURED MEASUREMENT</p><p className="mt-4 text-sm text-[var(--muted)]">{report.analysis.candidates.length} promoted candidate(s), {report.analysis.screened_candidates.length} screened review item(s).</p>{report.analysis.candidates.map((candidate) => <div key={candidate.candidate_id} className="mt-4 border-t border-[var(--line)] pt-4"><p className="mono text-xs text-[var(--ink)]">{candidate.candidate_id} · {candidate.classification}</p><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{candidate.interpretation}</p></div>)}</div><details className="border-t border-[var(--line)] pt-5"><summary className="focus-ring cursor-pointer mono text-[10px] uppercase tracking-[.14em] text-[var(--cyan)]">Show provenance manifest</summary><pre className="mt-4 overflow-auto border border-[var(--line)] bg-[var(--surface)] p-4 text-[10px] leading-5 text-[var(--muted)]">{JSON.stringify(report.manifest, null, 2)}</pre></details></section>;
}

function Preview({ label, preview, draw }: { label: string; preview: SpherexArchiveAnalysis['previews']['a']; draw: (canvas: HTMLCanvasElement | null, preview: SpherexArchiveAnalysis['previews']['a']) => void }) {
  return <div className="panel p-4"><p className="eyebrow">{label} · display preview only</p><canvas ref={(node) => draw(node, preview)} className="mt-4 aspect-square w-full image-rendering-pixelated bg-black" aria-label={`${label} SPHEREx archive cutout preview`} /><p className="mt-3 mono text-[9px] uppercase tracking-[.12em] text-[var(--quiet)]">{preview.width}×{preview.height} px · contrast-stretched for display · not measurement data</p></div>;
}
