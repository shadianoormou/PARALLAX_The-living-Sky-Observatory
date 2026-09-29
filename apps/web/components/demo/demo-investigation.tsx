'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, LockKeyhole, Pause, Play, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CandidateRecord, Consensus, ParallaxApiError, getArray, getNumber, parallaxApi } from '../../lib/parallax-api';
import { buildCandidateExplanation, spectralMetrics } from '../../lib/explanations';

const steps = [
  ['LOAD DEMO REGION', 'Load the labeled demonstration field'],
  ['COMPARE EPOCHS', 'See the same field at two moments'],
  ['BLINK', 'Let change reveal itself across time'],
  ['REVEAL DETECTED CHANGE', 'Expose the candidate extracted by the science engine'],
  ['OPEN CANDIDATE', 'Move from the field to its stored evidence record'],
  ['MEASURE WHAT MOVED', 'Read the measured displacement and quality limits'],
  ['BUILD SPECTRAL PROFILE', 'Compare the stored multi-band sample'],
  ['VERIFY THE EVIDENCE', 'Separate measurement from interpretation'],
  ['CLASSIFY THE CANDIDATE', 'Submit a public review before seeing consensus'],
  ['TRACE PROVENANCE', 'Follow candidate → run → dataset source'],
] as const;

const statuses = ['ALIGNING STAR FIELD', 'NORMALIZING OBSERVATIONS', 'SEARCHING FOR CHANGES', 'MEASURING CANDIDATE', 'BUILDING SPECTRAL PROFILE'];
const labels = [['moving_source', 'MOVING SOURCE'], ['brightness_change', 'BRIGHTNESS CHANGE'], ['imaging_artifact', 'IMAGING ARTIFACT'], ['uncertain', 'UNCERTAIN']] as const;
const confidenceLevels = ['LOW', 'MEDIUM', 'HIGH'] as const;

type Phase = 'idle' | 'running' | 'ready' | 'error';

export function DemoInvestigation() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [statusIndex, setStatusIndex] = useState(0);
  const [record, setRecord] = useState<CandidateRecord | null>(null);
  const [consensus, setConsensus] = useState<Consensus[] | null>(null);
  const [choice, setChoice] = useState('moving_source');
  const [confidence, setConfidence] = useState<(typeof confidenceLevels)[number] | ''>('');
  const [savingReview, setSavingReview] = useState(false);
  const [reviewSaved, setReviewSaved] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (phase !== 'running' || reducedMotion) return;
    const timer = window.setInterval(() => setStatusIndex((value) => (value + 1) % statuses.length), 620);
    return () => window.clearInterval(timer);
  }, [phase, reducedMotion]);

  const metrics = useMemo(() => {
    if (!record) return null;
    return {
      displacement: getArray(record.measurements, 'measurement.displacement_arcsec_xy'),
      displacementPixels: getArray(record.measurements, 'measurement.displacement_pixels_xy'),
      snr: getNumber(record.measurements, 'quality.positive_lobe_snr'),
      registration: getNumber(record.measurements, 'quality.registration_error'),
      relativeChange: getNumber(record.measurements, 'measurement.relative_change'),
    };
  }, [record]);

  async function start() {
    setPhase('running');
    setStatusIndex(0);
    setStep(0);
    setError(null);
    setRecord(null);
    setConsensus(null);
    setReviewSaved(false);
    try {
      await parallaxApi.runDemo();
      const candidates = await parallaxApi.listCandidates();
      const target = candidates.find((item) => item.candidateKey === 'PX-DEMO-017') ?? candidates.find((item) => item.classification === 'apparent_motion');
      if (!target) throw new Error('The demonstration pipeline returned no motion candidate.');
      setRecord(await parallaxApi.getRecord(target.id));
      setPhase('ready');
    } catch (caught) {
      setPhase('error');
      setError(caught instanceof ParallaxApiError ? caught.message : caught instanceof Error ? caught.message : 'The demonstration investigation could not start.');
    }
  }

  async function submitReview() {
    if (!record) return;
    setSavingReview(true);
    setError(null);
    try {
      await parallaxApi.submitClassification({ candidate_id: record.detail.id, label: choice, confidence: confidence || undefined });
      setConsensus(await parallaxApi.getConsensus(record.detail.id));
      setReviewSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The review could not be saved.');
    } finally {
      setSavingReview(false);
    }
  }

  const canAdvance = phase === 'ready' && !paused;
  return (
    <div className="space-y-5">
      <div className="panel overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-[var(--line)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div><p className="eyebrow">Presenter control / {phase === 'running' ? 'processing' : phase === 'ready' ? 'manual control' : 'ready'}</p><h2 className="mt-2 text-2xl font-medium tracking-[-.04em] text-[var(--ink)]">RUN DEMO INVESTIGATION</h2></div>
          <div className="flex flex-wrap items-center gap-2">
            {phase === 'idle' || phase === 'error' ? <button type="button" onClick={() => void start()} className="focus-ring inline-flex items-center gap-2 bg-[var(--signal)] px-5 py-3 mono text-[10px] font-medium uppercase tracking-[.14em] text-[var(--void)]"><Play size={13} /> Run real demo pipeline</button> : <button type="button" onClick={() => setPaused((value) => !value)} className="focus-ring inline-flex items-center gap-2 border border-[var(--line-strong)] px-4 py-3 mono text-[10px] uppercase tracking-[.12em] text-[var(--muted)] hover:text-[var(--ink)]" disabled={phase === 'running'}>{paused ? <Play size={13} /> : <Pause size={13} />}{paused ? 'Resume presentation' : 'Pause presentation'}</button>}
            {phase === 'ready' && <button type="button" onClick={() => void start()} className="focus-ring inline-flex items-center gap-2 border border-[var(--line-strong)] px-4 py-3 mono text-[10px] uppercase tracking-[.12em] text-[var(--muted)] hover:text-[var(--signal)]"><RefreshCw size={13} /> Restart</button>}
          </div>
        </div>
        {phase === 'running' && <div className="border-b border-[var(--line)] bg-[var(--signal-soft)] px-5 py-3 sm:px-8"><p className="mono text-[10px] uppercase tracking-[.15em] text-[var(--signal)]" aria-live="polite">{reducedMotion ? 'PROCESSING DEMONSTRATION DATASET' : statuses[statusIndex]}</p></div>}
        {error && <div className="border-b border-[var(--line)] bg-[rgba(243,187,113,.08)] px-5 py-3 text-sm text-[var(--amber)]" role="alert">{error}</div>}
        <div className="grid gap-0 lg:grid-cols-[250px_minmax(0,1fr)]">
          <ol className="border-b border-[var(--line)] bg-[var(--surface)] lg:border-b-0 lg:border-r">{steps.map(([label, description], index) => <li key={label}><button type="button" onClick={() => phase === 'ready' && setStep(index)} disabled={phase !== 'ready'} aria-current={step === index ? 'step' : undefined} className={`focus-ring flex w-full items-start gap-3 px-5 py-3 text-left transition-colors ${step === index ? 'bg-[var(--signal-soft)]' : 'hover:bg-[var(--surface-2)]'} disabled:cursor-default`}><span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border mono text-[9px] ${step === index ? 'border-[var(--signal)] text-[var(--signal)]' : index < step ? 'border-[var(--cyan)] text-[var(--cyan)]' : 'border-[var(--line-strong)] text-[var(--quiet)]'}`}>{index < step ? <Check size={11} /> : index + 1}</span><span><span className={`block mono text-[9px] uppercase tracking-[.1em] ${step === index ? 'text-[var(--signal)]' : 'text-[var(--muted)]'}`}>{label}</span><span className="mt-1 block text-[11px] leading-5 text-[var(--quiet)]">{description}</span></span></button></li>)}</ol>
          <div className="min-h-[520px] p-5 sm:p-8">{phase === 'idle' && <IdlePanel onStart={() => void start()} />}{phase === 'error' && <IdlePanel onStart={() => void start()} error={error} />}{phase === 'running' && <ProcessingPanel status={reducedMotion ? 'PROCESSING DEMONSTRATION DATASET' : statuses[statusIndex]} />}{phase === 'ready' && record && <div key={step} className="demo-step-enter">{renderStep(step, record, metrics, consensus, choice, confidence, setChoice, setConfidence, submitReview, savingReview, reviewSaved, canAdvance, () => setStep((value) => Math.max(0, value - 1)), () => setStep((value) => Math.min(steps.length - 1, value + 1)))}</div>}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 px-1"><p className="mono text-[9px] uppercase tracking-[.12em] text-[var(--quiet)]">{phase === 'ready' ? `Step ${step + 1} of ${steps.length} · ${paused ? 'presenter paused' : reducedMotion ? 'reduced motion' : 'manual control'}` : 'Data before conclusions'}</p>{phase === 'ready' && <div className="flex gap-2"><button type="button" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0} className="focus-ring inline-flex items-center gap-2 border border-[var(--line)] px-4 py-2.5 mono text-[10px] uppercase tracking-[.12em] text-[var(--muted)] disabled:opacity-30"><ArrowLeft size={13} /> Back</button><button type="button" onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))} disabled={!canAdvance || step === steps.length - 1} className="focus-ring inline-flex items-center gap-2 bg-[var(--signal)] px-4 py-2.5 mono text-[10px] uppercase tracking-[.12em] text-[var(--void)] disabled:opacity-30">Next <ArrowRight size={13} /></button></div>}</div>
    </div>
  );
}

function renderStep(step: number, record: CandidateRecord, metrics: { displacement: number[] | null; displacementPixels: number[] | null; snr: number | null; registration: number | null; relativeChange: number | null } | null, consensus: Consensus[] | null, choice: string, confidence: (typeof confidenceLevels)[number] | '', setChoice: (value: string) => void, setConfidence: (value: (typeof confidenceLevels)[number] | '') => void, submitReview: () => Promise<void>, savingReview: boolean, reviewSaved: boolean, canAdvance: boolean, back: () => void, next: () => void) {
  const epochA = record.provenance.epochA;
  const epochB = record.provenance.epochB;
  const explanation = buildCandidateExplanation({ classification: record.detail.classification, interpretation: record.detail.interpretation, measurements: record.measurements, spectrum: record.spectrum });
  const spectral = spectralMetrics(record.spectrum);
  const nextControl = <div className="mt-8 flex flex-wrap gap-3"><button type="button" onClick={back} className="focus-ring border border-[var(--line)] px-4 py-3 mono text-[10px] uppercase tracking-[.12em] text-[var(--muted)]">Back</button><button type="button" onClick={next} disabled={!canAdvance} className="focus-ring bg-[var(--signal)] px-4 py-3 mono text-[10px] uppercase tracking-[.12em] text-[var(--void)] disabled:opacity-40">Continue →</button></div>;
  if (step === 0) return <StepShell eyebrow="01 / Source" title="LOAD DEMO REGION" body="The API has run the deterministic synthetic analysis and stored its source, processing run, candidates, measurements, and provenance."><div className="grid gap-4 sm:grid-cols-2"><DemoFrame epoch="A" /><DemoFrame epoch="B" /></div><div className="mt-5 grid gap-4 sm:grid-cols-3"><Meta label="Source type" value="DEMONSTRATION DATASET" /><Meta label="Preset candidate" value={record.detail.candidateKey} /><Meta label="Algorithm" value={record.provenance.algorithmVersion} /></div>{nextControl}</StepShell>;
  if (step === 1) return <StepShell eyebrow="02 / Time" title="COMPARE EPOCHS" body="Same field, different observation epoch. The comparison begins with alignment and a shared coordinate frame."><EpochStage record={record} mode="pair" /><div className="mt-5 grid gap-4 sm:grid-cols-2"><Meta label="Epoch A" value={String(epochA.observation_id ?? 'synthetic-epoch-a')} /><Meta label="Epoch B" value={String(epochB.observation_id ?? 'synthetic-epoch-b')} /></div>{nextControl}</StepShell>;
  if (step === 2) return <StepShell eyebrow="03 / Time" title="BLINK" body="Alternating the registered epochs makes movement legible before interpretation enters the room."><EpochStage record={record} mode="blink" />{nextControl}</StepShell>;
  if (step === 3) return <StepShell eyebrow="04 / Detection" title="REVEAL DETECTED CHANGE" body="The science engine found a motion-like residual and promoted it as a candidate, not a discovery."><div className="border border-[var(--signal)]/40 bg-[var(--signal-soft)] p-6"><div className="flex items-start gap-4"><Sparkles className="mt-1 shrink-0 text-[var(--signal)]" size={20} /><div><p className="mono text-xs uppercase tracking-[.12em] text-[var(--signal)]">DEMONSTRATION CANDIDATE</p><h3 className="mt-3 text-2xl text-[var(--ink)]">{record.detail.candidateKey}</h3><p className="mt-3 text-sm leading-7 text-[var(--muted)]">{record.detail.interpretation}</p></div></div></div><div className="mt-5"><EpochStage record={record} mode="candidate" /></div>{nextControl}</StepShell>;
  if (step === 4) return <StepShell eyebrow="05 / Record" title="OPEN CANDIDATE" body="Now leave the image and inspect the stored record that connects candidate, measurements, spectrum, and provenance."><div className="grid gap-4 sm:grid-cols-2"><InfoCard label="Candidate" value={record.detail.candidateKey} /><InfoCard label="Status" value={record.detail.status.toUpperCase()} /><InfoCard label="Interpretation" value={record.detail.interpretation} /><InfoCard label="Dataset" value={record.detail.datasetLabel} /></div><Link href={`/candidates/${record.detail.id}`} className="focus-ring mt-7 inline-flex items-center gap-2 border-b border-[var(--signal)] pb-2 mono text-[10px] uppercase tracking-[.12em] text-[var(--signal)]">Open full candidate investigation →</Link>{nextControl}</StepShell>;
  if (step === 5) return <StepShell eyebrow="06 / Measurement" title="MEASURE WHAT MOVED" body="The measurement is explicit: displacement, signal quality, and registration error. It does not name a physical object."><div className="grid gap-4 sm:grid-cols-2"><InfoCard label="Pixel displacement" value={metrics?.displacementPixels ? `[${metrics.displacementPixels[0].toFixed(2)}, ${metrics.displacementPixels[1].toFixed(2)}] px` : 'not stored'} /><InfoCard label="Angular displacement" value={metrics?.displacement ? `[${metrics.displacement[0].toFixed(2)}, ${metrics.displacement[1].toFixed(2)}] arcsec` : 'not stored'} /><InfoCard label="Positive-lobe SNR" value={metrics?.snr?.toFixed(2) ?? 'not stored'} /><InfoCard label="Registration error" value={metrics?.registration?.toFixed(3) ?? 'not stored'} /></div><p className="mt-5 border-l-2 border-[var(--amber)] pl-4 text-sm leading-7 text-[var(--muted)]">Preferred conclusion: Motion-like candidate — additional observations required.</p>{nextControl}</StepShell>;
  if (step === 6) return <StepShell eyebrow="07 / Spectrum" title="BUILD SPECTRAL PROFILE" body="The stored sample comparison adds another evidence dimension without assigning a physical spectrum class."><SpectralPreview record={record} spectral={spectral} />{nextControl}</StepShell>;
  if (step === 7) return <StepShell eyebrow="08 / Evidence" title="VERIFY THE EVIDENCE" body="Measurement and interpretation stay separate. Read the evidence, then decide what level of confidence it deserves."><div className="panel bg-[var(--surface-2)] p-5"><p className="eyebrow">Why was this flagged?</p><p className="mt-4 text-lg leading-8 text-[var(--ink)]">{explanation}</p><p className="mt-5 border-t border-[var(--line)] pt-4 text-sm leading-7 text-[var(--muted)]">A candidate is not a discovery. False positives can come from detector artifacts, bad pixels, cosmic rays, or imperfect registration.</p></div>{nextControl}</StepShell>;
  if (step === 8) return <StepShell eyebrow="09 / Human review" title="CLASSIFY THE CANDIDATE" body="Submit your view before community consensus is shown. Your classification is a review action, not a scientific claim."><div className="grid gap-2 sm:grid-cols-2">{labels.map(([value, title]) => <button key={value} type="button" onClick={() => setChoice(value)} className={`focus-ring border p-4 text-left ${choice === value ? 'border-[var(--signal)] bg-[var(--signal-soft)]' : 'border-[var(--line)] bg-[var(--surface-2)]'}`}><span className="mono text-[10px] tracking-[.12em] text-[var(--ink)]">{title}</span></button>)}</div><div className="mt-5 flex flex-wrap gap-2"><span className="mono mr-2 self-center text-[9px] uppercase tracking-[.12em] text-[var(--quiet)]">Confidence</span>{confidenceLevels.map((level) => <button key={level} type="button" onClick={() => setConfidence(confidence === level ? '' : level)} className={`focus-ring border px-3 py-2 mono text-[9px] ${confidence === level ? 'border-[var(--cyan)] text-[var(--cyan)]' : 'border-[var(--line)] text-[var(--muted)]'}`}>{level}</button>)}</div><button type="button" onClick={() => void submitReview()} disabled={savingReview} className="focus-ring mt-6 bg-[var(--signal)] px-5 py-3 mono text-[10px] uppercase tracking-[.12em] text-[var(--void)] disabled:opacity-40">{savingReview ? 'Saving classification…' : reviewSaved ? 'Classification saved · update vote' : 'Submit classification'}</button>{consensus && <div className="mt-6 border-t border-[var(--line)] pt-5"><p className="eyebrow">Community opinion · {consensus[0]?.totalVotes ?? 0} reviewers</p><p className="mt-2 text-xs text-[var(--muted)]">Community opinion, not scientific truth.</p><div className="mt-4 space-y-3">{consensus.map((item) => <div key={item.classificationLabel}><div className="flex justify-between text-xs"><span>{item.classificationLabel.replaceAll('_', ' ')}</span><span className="mono text-[var(--cyan)]">{Math.round(item.agreementFraction * 100)}%</span></div><div className="mt-1 h-1.5 bg-[var(--surface-2)]"><div className="h-full bg-[var(--cyan)]" style={{ width: `${item.agreementFraction * 100}%` }} /></div></div>)}</div></div>}{nextControl}</StepShell>;
  return <StepShell eyebrow="10 / Trace" title="TRACE PROVENANCE" body="The final stop is the source trail: candidate → processing run → dataset source. The demo is synthetic and labeled honestly."><div className="grid gap-3 sm:grid-cols-3"><TraceNode label="Candidate" value={record.detail.candidateKey} /><TraceNode label="Processing run" value={record.detail.processingRunId.slice(0, 12)} /><TraceNode label="Dataset source" value={record.provenance.sourceIdentifier} /></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><InfoCard label="Epochs" value={`${String(epochA.observation_id ?? 'A')} → ${String(epochB.observation_id ?? 'B')}`} /><InfoCard label="Generated / processed" value={new Date(record.provenance.processingCompletedAtUtc ?? record.provenance.processingStartedAtUtc).toLocaleString()} /></div><div className="mt-6 flex flex-wrap gap-4"><Link href={`/candidates/${record.detail.id}`} className="focus-ring inline-flex items-center gap-2 border border-[var(--line-strong)] px-4 py-3 mono text-[10px] uppercase tracking-[.12em] text-[var(--muted)]">Candidate record →</Link><Link href="/provenance" className="focus-ring inline-flex items-center gap-2 border border-[var(--line-strong)] px-4 py-3 mono text-[10px] uppercase tracking-[.12em] text-[var(--muted)]"><ShieldCheck size={13} /> Full provenance</Link></div><div className="mt-8 border-t border-[var(--line)] pt-5"><p className="mono text-[10px] uppercase tracking-[.14em] text-[var(--signal)]">Motion-like candidate — additional observations required.</p></div></StepShell>;
}

function StepShell({ eyebrow, title, body, children }: { eyebrow: string; title: string; body: string; children: React.ReactNode }) { return <section><p className="eyebrow">{eyebrow}</p><h3 className="mt-3 text-3xl font-medium tracking-[-.05em] text-[var(--ink)] sm:text-4xl">{title}</h3><p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">{body}</p><div className="mt-7">{children}</div></section>; }
function IdlePanel({ onStart, error }: { onStart: () => void; error?: string | null }) { return <div className="grid min-h-[430px] place-items-center text-center"><div className="max-w-md"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-[var(--signal)]/30 bg-[var(--signal-soft)] text-[var(--signal)]"><Sparkles size={24} /></div><p className="eyebrow mt-6">DATA BEFORE CONCLUSIONS</p><h3 className="mt-3 text-3xl font-medium tracking-[-.05em] text-[var(--ink)]">A three-minute investigation, with manual control.</h3><p className="mt-4 text-sm leading-7 text-[var(--muted)]">Run the real demonstration pipeline, inspect its stored measurements, submit a classification, and finish at provenance.</p>{error && <p className="mt-4 text-sm text-[var(--amber)]">{error}</p>}<button type="button" onClick={onStart} className="focus-ring mt-7 bg-[var(--signal)] px-5 py-4 mono text-[10px] font-medium uppercase tracking-[.14em] text-[var(--void)]">Run demo investigation</button></div></div>; }
function ProcessingPanel({ status }: { status: string }) { return <div className="grid min-h-[430px] place-items-center text-center"><div><div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-[var(--signal)]/30 bg-[var(--signal-soft)] text-[var(--signal)] motion-safe:animate-[orbitalPulse_1.4s_ease-in-out_infinite]"><LockKeyhole size={24} /></div><p className="eyebrow mt-6">DEMONSTRATION DATASET</p><h3 className="mt-3 text-2xl font-medium text-[var(--ink)]" aria-live="polite">{status}</h3><p className="mt-3 text-sm text-[var(--muted)]">Calling the science engine and persisting the evidence trail.</p></div></div>; }
function InfoCard({ label, value }: { label: string; value: string }) { return <div className="border border-[var(--line)] bg-[var(--surface-2)] p-4"><p className="mono text-[9px] uppercase tracking-[.1em] text-[var(--quiet)]">{label}</p><p className="mt-3 break-words text-sm leading-6 text-[var(--ink)]">{value}</p></div>; }
function Meta({ label, value }: { label: string; value: string }) { return <InfoCard label={label} value={value} />; }
function TraceNode({ label, value }: { label: string; value: string }) { return <div className="border-l-2 border-[var(--cyan)] bg-[var(--surface-2)] p-4"><p className="eyebrow text-[var(--cyan)]">{label}</p><p className="mt-3 break-all mono text-xs text-[var(--ink)]">{value}</p></div>; }

function EpochStage({ record, mode }: { record: CandidateRecord; mode: 'pair' | 'blink' | 'candidate' }) { const [epoch, setEpoch] = useState<'A' | 'B'>('A'); const [playing, setPlaying] = useState(mode === 'blink'); useEffect(() => { if (mode !== 'blink' || !playing) return; const timer = window.setInterval(() => setEpoch((value) => value === 'A' ? 'B' : 'A'), 850); return () => window.clearInterval(timer); }, [mode, playing]); return <div><div className={`grid gap-3 ${mode === 'pair' ? 'sm:grid-cols-2' : ''}`}>{mode === 'pair' ? <><DemoFrame epoch="A" /><DemoFrame epoch="B" /></> : <DemoFrame epoch={epoch} record={record} highlight={mode === 'candidate'} />}</div>{mode === 'blink' && <button type="button" onClick={() => setPlaying((value) => !value)} className="focus-ring mt-4 inline-flex items-center gap-2 border border-[var(--line-strong)] px-4 py-2.5 mono text-[10px] uppercase tracking-[.12em] text-[var(--muted)]">{playing ? <Pause size={13} /> : <Play size={13} />} {playing ? 'Pause blink' : 'Resume blink'} · Epoch {epoch}</button>}</div>; }
function SpectralPreview({ record, spectral }: { record: CandidateRecord; spectral: ReturnType<typeof spectralMetrics> }) { const spectrum = record.spectrum; if (!spectrum) return <InfoCard label="Spectrum" value="No spectrum is stored for this candidate." />; const max = Math.max(...spectrum.fluxEpochA, ...spectrum.fluxEpochB, 1); const points = (values: number[]) => values.map((value, index) => `${index / Math.max(values.length - 1, 1) * 100},${100 - value / max * 78 - 10}`).join(' '); return <div className="panel p-5"><div className="flex items-center justify-between"><div><p className="eyebrow">Stored sample / {spectrum.sourceId}</p><p className="mt-2 text-sm text-[var(--muted)]">{spectral ? `${spectral.wavelengthCount} measured bands · normalized Δ ${spectral.normalizedDelta.toFixed(3)}` : 'comparison metrics unavailable'}</p></div><span className="mono text-[10px] text-[var(--quiet)]">μm</span></div><svg viewBox="0 0 100 100" className="mt-5 h-44 w-full" role="img" aria-label="Epoch A and Epoch B spectral profile"><polyline points={points(spectrum.fluxEpochA)} fill="none" stroke="#c8ff6b" strokeWidth="1.8" /><polyline points={points(spectrum.fluxEpochB)} fill="none" stroke="#8de5e2" strokeWidth="1.8" strokeDasharray="2 2" /></svg><div className="mt-3 flex gap-5 mono text-[9px] uppercase tracking-[.1em] text-[var(--quiet)]"><span className="text-[var(--signal)]">— Epoch A</span><span className="text-[var(--cyan)]">- - Epoch B</span></div></div>; }

type DemoImage = { width: number; height: number; pixels: Uint8Array };
function DemoFrame({ epoch, record, highlight = false }: { epoch: 'A' | 'B'; record?: CandidateRecord; highlight?: boolean }) { const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null); const [image, setImage] = useState<DemoImage | null>(null); useEffect(() => { let active = true; void fetch(`/api/demo-assets/epoch-${epoch.toLowerCase()}.pgm`).then((response) => response.arrayBuffer()).then((buffer) => { if (active) setImage(parsePgm(buffer)); }); return () => { active = false; }; }, [epoch]); useEffect(() => { if (!canvas || !image) return; const context = canvas.getContext('2d'); if (!context) return; const width = canvas.clientWidth || 640; const height = canvas.clientHeight || 360; const dpr = window.devicePixelRatio || 1; canvas.width = width * dpr; canvas.height = height * dpr; context.setTransform(dpr, 0, 0, dpr, 0, 0); const offscreen = document.createElement('canvas'); offscreen.width = image.width; offscreen.height = image.height; const offscreenContext = offscreen.getContext('2d'); if (!offscreenContext) return; const pixels = offscreenContext.createImageData(image.width, image.height); image.pixels.forEach((value, index) => { const offset = index * 4; pixels.data[offset] = Math.min(255, value * .82); pixels.data[offset + 1] = Math.min(255, value * .97 + 10); pixels.data[offset + 2] = Math.min(255, value * .99 + 15); pixels.data[offset + 3] = 255; }); offscreenContext.putImageData(pixels, 0, 0); context.fillStyle = '#070b0d'; context.fillRect(0, 0, width, height); const scale = Math.min((width - 24) / image.width, (height - 24) / image.height); const x = (width - image.width * scale) / 2; const y = (height - image.height * scale) / 2; context.imageSmoothingEnabled = false; context.drawImage(offscreen, x, y, image.width * scale, image.height * scale); if (highlight && record) { const position = getArray(record.measurements, epoch === 'A' ? 'measurement.position_a_xy' : 'measurement.position_b_xy') ?? getArray(record.measurements, 'measurement.position_xy'); if (position && position.length >= 2) { const px = x + position[0] * scale; const py = y + position[1] * scale; context.strokeStyle = '#c8ff6b'; context.lineWidth = 2; context.beginPath(); context.arc(px, py, 12, 0, Math.PI * 2); context.stroke(); context.beginPath(); context.moveTo(px - 18, py); context.lineTo(px + 18, py); context.moveTo(px, py - 18); context.lineTo(px, py + 18); context.stroke(); } } }, [canvas, epoch, image, record, highlight]); return <div className="relative overflow-hidden border border-[var(--line)] bg-[#070b0d]"><canvas ref={setCanvas} className="block h-52 w-full sm:h-64" role="img" aria-label={`Demonstration Epoch ${epoch} sky frame`} /><span className="absolute left-3 top-3 border border-[var(--line)] bg-[rgba(7,11,13,.75)] px-2 py-1 mono text-[9px] uppercase tracking-[.12em] text-[var(--muted)]">EPOCH {epoch}</span></div>; }
function parsePgm(buffer: ArrayBuffer): DemoImage { const bytes = new Uint8Array(buffer); let cursor = 0; const token = (): string => { while (cursor < bytes.length && bytes[cursor] <= 32) cursor += 1; const start = cursor; while (cursor < bytes.length && bytes[cursor] > 32) cursor += 1; return new TextDecoder().decode(bytes.slice(start, cursor)); }; if (token() !== 'P5') throw new Error('Unsupported demo image format.'); const width = Number(token()); const height = Number(token()); const max = Number(token()); while (cursor < bytes.length && bytes[cursor] <= 32) cursor += 1; if (!width || !height || max !== 255) throw new Error('Unsupported demo image dimensions.'); return { width, height, pixels: bytes.slice(cursor, cursor + width * height) }; }
