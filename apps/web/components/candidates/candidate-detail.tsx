'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Copy, Download, Info, Play, Pause, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useMode } from '../mode-context';
import { CandidateRecord, ParallaxApiError, getArray, getNumber, parallaxApi } from '../../lib/parallax-api';
import { buildCandidateExplanation, spectralMetrics } from '../../lib/explanations';

type SpectrumMode = 'overlay' | 'difference' | 'normalized';

function numberText(value: number | null | undefined, digits = 2) {
  return value === null || value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(digits);
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function CandidateDetail() {
  const params = useParams<{ id: string }>();
  const { expert } = useMode();
  const id = params.id;
  const [record, setRecord] = useState<CandidateRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRecord(await parallaxApi.getRecord(id));
    } catch (caught) {
      setError(caught instanceof ParallaxApiError && caught.status === 404 ? 'This candidate record does not exist in the current dataset.' : caught instanceof Error ? caught.message : 'The candidate record could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <DetailState eyebrow="Reading evidence" title="MEASURING CANDIDATE" body="Loading stored measurements, spectrum, and provenance." />;
  if (error || !record) return <DetailState eyebrow="Candidate unavailable" title="Evidence is not available." body={error ?? 'No candidate record was returned.'} retry={load} />;
  return <CandidateInvestigation record={record} expert={expert} />;
}

function CandidateInvestigation({ record, expert }: { record: CandidateRecord; expert: boolean }) {
  const [downloaded, setDownloaded] = useState(false);
  const [shared, setShared] = useState(false);
  const displacement = getArray(record.measurements, 'measurement.displacement_arcsec_xy');
  const displacementPixels = getArray(record.measurements, 'measurement.displacement_pixels_xy');
  const position = getArray(record.measurements, 'measurement.position_xy');
  const positionA = getArray(record.measurements, 'measurement.position_a_xy');
  const positionB = getArray(record.measurements, 'measurement.position_b_xy');
  const deltaFlux = getNumber(record.measurements, 'measurement.delta_flux');
  const relativeChange = getNumber(record.measurements, 'measurement.relative_change');
  const snr = getNumber(record.measurements, 'quality.component_snr');
  const registrationError = getNumber(record.measurements, 'quality.registration_error');
  const shapeRatio = getNumber(record.measurements, 'quality.shape_ratio') ?? getNumber(record.measurements, 'measurement.shape_ratio');
  const area = getNumber(record.measurements, 'quality.area_pixels') ?? getNumber(record.measurements, 'measurement.area_pixels');
  const spectral = spectralMetrics(record.spectrum);
  const explanation = buildCandidateExplanation({ classification: record.detail.classification, interpretation: record.detail.interpretation, measurements: record.measurements, spectrum: record.spectrum });
  const epochA = objectValue(record.provenance.epochA);
  const epochB = objectValue(record.provenance.epochB);

  const download = () => {
    const payload = { dataset_label: record.detail.datasetLabel, candidate: record.detail, measurements: record.measurements, spectrum: record.spectrum, provenance: record.provenance, explanation, spectral_metrics: spectral };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${record.detail.candidateKey}-metadata.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  };

  const share = async () => {
    const url = `${window.location.origin}/candidates/${record.detail.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
    } catch {
      setShared(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[var(--void)]">
      <div className="observatory-grid mx-auto min-h-[calc(100vh-72px)] max-w-[1440px] px-5 py-8 sm:px-8 lg:px-12">
        <div className="flex flex-wrap items-center justify-between gap-4"><Link href="/candidates" className="focus-ring inline-flex items-center gap-2 mono text-[10px] uppercase tracking-[.12em] text-[var(--muted)] hover:text-[var(--signal)]"><ArrowLeft size={14} /> Back to Sky Mysteries</Link><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-[var(--signal)]/30 bg-[var(--signal-soft)] px-2.5 py-1 mono text-[9px] uppercase tracking-[.12em] text-[var(--signal)]">{record.detail.status}</span><button type="button" onClick={() => void share()} className="focus-ring inline-flex items-center gap-2 rounded-full border border-[var(--line-strong)] px-3 py-2 mono text-[9px] uppercase tracking-[.1em] text-[var(--muted)] hover:border-[var(--cyan)] hover:text-[var(--cyan)]"><Copy size={13} /> {shared ? 'Review link copied' : 'Copy review link'}</button><button type="button" onClick={download} className="focus-ring inline-flex items-center gap-2 rounded-full border border-[var(--line-strong)] px-3 py-2 mono text-[9px] uppercase tracking-[.1em] text-[var(--muted)] hover:border-[var(--signal)] hover:text-[var(--signal)]"><Download size={13} /> {downloaded ? 'Exported' : 'Export evidence JSON'}</button></div></div>
        <header className="mt-8 border-b border-[var(--line)] pb-8"><p className="eyebrow">Candidate investigation / {record.detail.candidateKey}</p><div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="text-4xl font-medium tracking-[-.06em] text-[var(--ink)] sm:text-5xl">What changed?</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">A structured investigation of a {record.detail.classification.replaceAll('_', ' ')} candidate. Measurement stays separate from interpretation.</p></div><Link href={`/explore?candidate=${record.detail.id}`} className="focus-ring inline-flex w-fit items-center gap-2 rounded-full bg-[var(--signal)] px-4 py-3 mono text-[10px] uppercase tracking-[.12em] text-[var(--void)]">Open in observatory <ArrowUpRight size={14} /></Link></div></header>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Identity label="Candidate ID" value={record.detail.candidateKey} /><Identity label="Classification" value={record.detail.classification.replaceAll('_', ' ')} /><Identity label="Epoch A / B" value={`${String(epochA.observation_id ?? 'A')} → ${String(epochB.observation_id ?? 'B')}`} /><Identity label="Dataset" value={record.detail.datasetLabel} /></section>

        <section className="mt-8"><div className="mb-4 flex items-end justify-between gap-4"><div><p className="eyebrow">Evidence comparison</p><h2 className="mt-2 text-2xl font-medium tracking-[-.04em] text-[var(--ink)]">Position · Brightness · Spectrum</h2></div><span className="mono text-[9px] uppercase tracking-[.1em] text-[var(--quiet)]">stored / calculated values</span></div><div className="grid gap-4 lg:grid-cols-3"><EvidenceCard title="Position" tone="cyan"><div className="grid grid-cols-2 gap-4"><Value label="Epoch A" value={positionA ? `[${numberText(positionA[0])}, ${numberText(positionA[1])}]` : position ? `[${numberText(position[0])}, ${numberText(position[1])}]` : '—'} unit="pixel frame" /><Value label="Epoch B" value={positionB ? `[${numberText(positionB[0])}, ${numberText(positionB[1])}]` : position ? `[${numberText(position[0])}, ${numberText(position[1])}]` : '—'} unit="pixel frame" /></div><div className="mt-5 border-t border-[var(--line)] pt-4"><Value label="Measured displacement" value={displacement ? `${numberText(displacement[0])}, ${numberText(displacement[1])}` : '—'} unit="arcsec Δx / Δy" /></div><p className="mt-4 text-[11px] leading-5 text-[var(--quiet)]">RA / Dec are unavailable because this demonstration field is a synthetic tangent-plane pixel frame.</p></EvidenceCard><EvidenceCard title="Brightness" tone="amber"><Value label="Flux difference" value={deltaFlux === null ? '—' : numberText(deltaFlux)} unit="relative units · Epoch B − A" /><div className="mt-5 grid grid-cols-2 gap-4"><Value label="Relative change" value={relativeChange === null ? '—' : `${numberText(relativeChange * 100, 1)}%`} unit="from Epoch A" /><Value label="Aperture quality" value={area === null ? '—' : numberText(area, 0)} unit="area pixels" /></div><p className="mt-5 text-[11px] leading-5 text-[var(--quiet)]">A brightness interpretation is shown only when a stored flux measurement exists.</p></EvidenceCard><EvidenceCard title="Spectrum" tone="signal"><div className="flex items-center justify-between"><Value label="Wavelength samples" value={spectral ? `${spectral.wavelengthCount}` : '—'} unit="stored bands" /><Value label="Normalized Δ" value={spectral ? numberText(spectral.normalizedDelta, 3) : '—'} unit="B vs A" /></div>{record.spectrum ? <MiniSpectrum spectrum={record.spectrum} /> : <p className="mt-6 text-sm text-[var(--muted)]">Spectrum unavailable for this candidate.</p>}<p className="mt-3 text-[11px] leading-5 text-[var(--quiet)]">Metrics describe the stored sample comparison; they do not assign a physical class.</p></EvidenceCard></div></section>

        <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="panel p-5 sm:p-7"><p className="eyebrow">Why did PARALLAX flag this?</p><h2 className="mt-3 text-2xl font-medium tracking-[-.04em] text-[var(--ink)]">Evidence before interpretation.</h2><p className="mt-5 max-w-3xl text-base leading-8 text-[var(--ink)]">{explanation}</p><div className="mt-7 border-t border-[var(--line)] pt-5"><p className="mono text-[9px] uppercase tracking-[.12em] text-[var(--quiet)]">Science service interpretation</p><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{record.detail.interpretation}</p></div></div><EvidenceBreakdown record={record} spectral={spectral} /></section>

        {record.spectrum && <section className="mt-8"><SpectralBlink spectrum={record.spectrum} /></section>}

        <section className="mt-8 grid gap-5 lg:grid-cols-2"><ProvenanceCard record={record} epochA={epochA} epochB={epochB} /><QualityCard expert={expert} registrationError={registrationError} snr={snr} shapeRatio={shapeRatio} area={area} displacementPixels={displacementPixels} /></section>
      </div>
    </main>
  );
}

function Identity({ label: identityLabel, value }: { label: string; value: string }) { return <div className="panel p-4"><p className="mono text-[8px] uppercase tracking-[.1em] text-[var(--quiet)]">{identityLabel}</p><p className="mt-2 break-words text-sm capitalize text-[var(--ink)]">{value}</p></div>; }

function EvidenceCard({ title, tone, children }: { title: string; tone: 'cyan' | 'amber' | 'signal'; children: React.ReactNode }) { const color = tone === 'cyan' ? 'text-[var(--cyan)]' : tone === 'amber' ? 'text-[var(--amber)]' : 'text-[var(--signal)]'; return <div className="panel p-5"><p className={`eyebrow ${color}`}>{title}</p><div className="mt-5">{children}</div></div>; }

function Value({ label: valueLabel, value, unit }: { label: string; value: string; unit: string }) { return <div><p className="mono text-[8px] uppercase tracking-[.1em] text-[var(--quiet)]">{valueLabel}</p><p className="mt-1 break-words text-lg text-[var(--ink)]">{value}</p><p className="mt-1 mono text-[8px] uppercase tracking-[.08em] text-[var(--quiet)]">{unit}</p></div>; }

function MiniSpectrum({ spectrum }: { spectrum: CandidateRecord['spectrum'] }) { if (!spectrum) return null; const max = Math.max(...spectrum.fluxEpochA, ...spectrum.fluxEpochB, 1); const points = (values: number[]) => values.map((value, index) => `${index / Math.max(values.length - 1, 1) * 100},${100 - value / max * 76 - 10}`).join(' '); return <svg viewBox="0 0 100 100" className="mt-5 h-28 w-full" role="img" aria-label="Stored Epoch A and Epoch B spectra"><polyline points={points(spectrum.fluxEpochA)} fill="none" stroke="#c8ff6b" strokeWidth="1.8" /><polyline points={points(spectrum.fluxEpochB)} fill="none" stroke="#8de5e2" strokeWidth="1.8" strokeDasharray="2 2" /></svg>; }

function EvidenceBreakdown({ record, spectral }: { record: CandidateRecord; spectral: ReturnType<typeof spectralMetrics> }) { const displacement = getArray(record.measurements, 'measurement.displacement_arcsec_xy'); const relativeChange = getNumber(record.measurements, 'measurement.relative_change'); const snr = getNumber(record.measurements, 'quality.component_snr'); const registration = getNumber(record.measurements, 'quality.registration_error'); return <div className="panel p-5"><p className="eyebrow">Evidence breakdown</p><div className="mt-5 space-y-4"><Breakdown label="Positional displacement" value={displacement ? `${numberText(Math.hypot(displacement[0], displacement[1]))} arcsec` : 'not measured'} /><Breakdown label="Reference stability" value={registration === null ? 'not stored' : `${numberText(registration)} px registration error`} /><Breakdown label="Residual strength" value={snr === null ? 'not stored' : `${numberText(snr)} component SNR`} /><Breakdown label="Brightness variation" value={relativeChange === null ? 'not measured' : `${numberText(relativeChange * 100, 1)}% relative change`} /><Breakdown label="Spectral similarity" value={spectral ? `normalized Δ ${numberText(spectral.normalizedDelta, 3)}` : 'not available'} /><Breakdown label="Uncertainty" value={record.detail.classification === 'uncertain' ? 'needs review · low SNR' : 'separate uncertainty not stored'} /></div></div>; }

function Breakdown({ label: breakdownLabel, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] pb-3 last:border-0 last:pb-0"><span className="text-xs text-[var(--muted)]">{breakdownLabel}</span><span className="text-right mono text-[10px] text-[var(--ink)]">{value}</span></div>; }

function ProvenanceCard({ record, epochA, epochB }: { record: CandidateRecord; epochA: Record<string, unknown>; epochB: Record<string, unknown> }) { return <section className="panel p-5 sm:p-7"><div className="flex items-center justify-between"><div><p className="eyebrow">Data provenance</p><h2 className="mt-2 text-xl font-medium tracking-[-.03em] text-[var(--ink)]">Traceable by construction.</h2></div><ShieldCheck className="text-[var(--signal)]" size={20} /></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><Meta label="Dataset" value={record.provenance.datasetLabel} /><Meta label="Source" value={record.provenance.sourceIdentifier} /><Meta label="Algorithm" value={record.provenance.algorithmVersion} /><Meta label="Frame" value={String(epochA.coordinate_frame ?? '—')} /><Meta label="Epoch A" value={String(epochA.observation_id ?? '—')} /><Meta label="Epoch B" value={String(epochB.observation_id ?? '—')} /></div><p className="mt-6 border-t border-[var(--line)] pt-4 text-xs leading-6 text-[var(--quiet)]">{String(epochA.provenance_status ?? record.provenance.datasetProvenance)}</p></section>; }

function Meta({ label: metaLabel, value }: { label: string; value: string }) { return <div><p className="mono text-[8px] uppercase tracking-[.1em] text-[var(--quiet)]">{metaLabel}</p><p className="mt-1 break-words text-xs leading-5 text-[var(--muted)]">{value}</p></div>; }

function QualityCard({ expert, registrationError, snr, shapeRatio, area, displacementPixels }: { expert: boolean; registrationError: number | null; snr: number | null; shapeRatio: number | null; area: number | null; displacementPixels: number[] | null }) { return <section className="panel p-5 sm:p-7"><div className="flex items-center justify-between"><div><p className="eyebrow">Quality and limits</p><h2 className="mt-2 text-xl font-medium tracking-[-.03em] text-[var(--ink)]">What the measurement can support.</h2></div><Info className="text-[var(--cyan)]" size={20} /></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><Meta label="Registration error" value={registrationError === null ? 'not stored' : `${numberText(registrationError)} px`} /><Meta label="Component SNR" value={snr === null ? 'not stored' : numberText(snr)} /><Meta label="Shape ratio" value={shapeRatio === null ? 'not stored' : numberText(shapeRatio)} /><Meta label="Area" value={area === null ? 'not stored' : `${numberText(area, 0)} px²`} /><Meta label="Pixel displacement" value={displacementPixels ? `${numberText(displacementPixels[0])}, ${numberText(displacementPixels[1])}` : 'not measured'} /><Meta label="Nearby contamination" value="not computed by this pipeline" /></div>{expert && <p className="mt-6 border-t border-[var(--line)] pt-4 mono text-[9px] uppercase leading-5 tracking-[.1em] text-[var(--quiet)]">Expert mode exposes stored component metrics. No unsupported probability or composite confidence is displayed.</p>}</section>; }

function SpectralBlink({ spectrum }: { spectrum: NonNullable<CandidateRecord['spectrum']> }) {
  const [mode, setMode] = useState<SpectrumMode>('overlay');
  const [playing, setPlaying] = useState(false);
  const [mix, setMix] = useState(0);
  const max = Math.max(...spectrum.fluxEpochA, ...spectrum.fluxEpochB, 1);
  const plotMax = mode === 'normalized' ? 1 : max;
  const minWave = Math.min(...spectrum.wavelengthUm);
  const maxWave = Math.max(...spectrum.wavelengthUm);
  const x = (wave: number) => (wave - minWave) / Math.max(maxWave - minWave, 1) * 100;
  const y = (value: number) => 100 - value / plotMax * 78 - 10;
  const normalized = (values: number[]) => { const scale = Math.max(...values, 1e-9); return values.map((value) => value / scale); };
  const valuesA = mode === 'normalized' ? normalized(spectrum.fluxEpochA) : spectrum.fluxEpochA;
  const valuesB = mode === 'normalized' ? normalized(spectrum.fluxEpochB) : spectrum.fluxEpochB;
  const delta = spectrum.fluxEpochB.map((value, index) => value - spectrum.fluxEpochA[index]);
  const path = (values: number[]) => values.map((value, index) => `${x(spectrum.wavelengthUm[index])},${y(mode === 'difference' ? value + max / 2 : value)}`).join(' ');

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setMix((value) => value >= 1 ? 0 : Math.min(1, value + .08)), 100);
    return () => window.clearInterval(timer);
  }, [playing]);

  return <div className="panel overflow-hidden"><div className="flex flex-col gap-4 border-b border-[var(--line)] px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-7"><div><p className="eyebrow">Spectral blink / {spectrum.sourceId}</p><h2 className="mt-2 text-2xl font-medium tracking-[-.04em] text-[var(--ink)]">A spectrum is another way to see change.</h2><p className="mt-2 max-w-2xl text-xs leading-6 text-[var(--muted)]">Hover a band to inspect its wavelength and stored value. Color follows wavelength across the measured sample range.</p></div><div className="flex flex-wrap gap-2">{(['overlay', 'difference', 'normalized'] as SpectrumMode[]).map((item) => <button key={item} type="button" onClick={() => setMode(item)} className={`focus-ring rounded-full px-3 py-2 mono text-[9px] uppercase tracking-[.1em] ${mode === item ? 'bg-[var(--signal)] text-[var(--void)]' : 'border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'}`}>{item}</button>)}<button type="button" onClick={() => setPlaying(!playing)} className="focus-ring inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-3 py-2 mono text-[9px] uppercase tracking-[.1em] text-[var(--muted)] hover:text-[var(--signal)]">{playing ? <Pause size={12} /> : <Play size={12} />} {playing ? 'Pause' : 'Spectral blink'}</button></div></div><div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_270px]"><div><svg viewBox="0 0 100 100" className="h-72 w-full overflow-visible" role="img" aria-label="Interactive Epoch A and Epoch B spectral comparison"><line x1="0" y1="90" x2="100" y2="90" stroke="rgba(199,218,224,.22)" />{mode === 'difference' ? <polyline points={path(delta)} fill="none" stroke="#f3bb71" strokeWidth="1.7" /> : <><polyline points={path(valuesA)} fill="none" stroke="#c8ff6b" strokeWidth="1.8" opacity={playing ? 1 - mix * .7 : 1} /><polyline points={path(valuesB)} fill="none" stroke="#8de5e2" strokeWidth="1.8" strokeDasharray="2 2" opacity={playing ? .3 + mix * .7 : 1} /></>}{spectrum.wavelengthUm.map((wave, index) => <circle key={wave} cx={x(wave)} cy={y(mode === 'difference' ? delta[index] + max / 2 : valuesA[index] * (1 - mix) + valuesB[index] * mix)} r="2.2" fill={`hsl(${220 - index / Math.max(spectrum.wavelengthUm.length - 1, 1) * 170} 75% 68%)`}><title>{`${wave.toFixed(2)} μm · A ${spectrum.fluxEpochA[index].toFixed(3)} · B ${spectrum.fluxEpochB[index].toFixed(3)} · uncertainty not stored`}</title></circle>)}</svg><div className="mt-3 flex flex-wrap gap-5 mono text-[9px] uppercase tracking-[.1em] text-[var(--quiet)]"><span className="text-[var(--signal)]">— Epoch A</span><span className="text-[var(--cyan)]">- - Epoch B</span><span className="text-[var(--amber)]">— Difference</span><span>{playing ? `transition ${(mix * 100).toFixed(0)}%` : 'hover points for values'}</span></div></div><div className="border-t border-[var(--line)] pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0"><p className="mono text-[9px] uppercase tracking-[.12em] text-[var(--quiet)]">Band readout</p><div className="mt-4 space-y-3">{spectrum.wavelengthUm.map((wave, index) => <div key={wave} className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-3 mono text-[10px]"><span className="text-[var(--muted)]">{wave.toFixed(2)} μm</span><span className="text-right text-[var(--ink)]">A {spectrum.fluxEpochA[index].toFixed(3)}<br />B {spectrum.fluxEpochB[index].toFixed(3)}</span></div>)}</div><p className="mt-4 text-[11px] leading-5 text-[var(--quiet)]">Uncertainty values are not stored for this synthetic sample. The plot does not infer a physical spectrum class.</p></div></div></div>;
}

function DetailState({ eyebrow, title, body, retry }: { eyebrow: string; title: string; body: string; retry?: () => Promise<void> }) {
  return <main className="min-h-[calc(100vh-72px)] bg-[var(--void)]"><div className="observatory-grid mx-auto grid min-h-[calc(100vh-72px)] max-w-[1440px] place-items-center px-5 py-10 sm:px-8 lg:px-12"><div className="panel max-w-lg p-8 text-center"><Sparkles className="mx-auto text-[var(--signal)]" size={24} /><p className="eyebrow mt-5">{eyebrow}</p><h1 className="mt-3 text-2xl font-medium tracking-[-.04em] text-[var(--ink)]">{title}</h1><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{body}</p>{retry && <button type="button" onClick={() => void retry()} className="focus-ring mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--line-strong)] px-4 py-3 mono text-[10px] uppercase tracking-[.1em] text-[var(--muted)] hover:text-[var(--signal)]"><RefreshCw size={13} /> Retry</button>}</div></div></main>;
}
