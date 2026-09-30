'use client';

import Link from 'next/link';
import { AlertTriangle, Check, Eye, GitCompareArrows, Network, RefreshCw, Send, ShieldCheck, ShieldX, Telescope } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CommunityMetrics, ParallaxApiError, ResearchFeedbackMetrics, SpherexEvidenceBand, SpherexEvidenceGraph, parallaxApi } from '../../lib/parallax-api';

const BAND_OPTIONS = ['SPHEREx-D3', 'SPHEREx-D4', 'SPHEREx-D5', 'SPHEREx-D6'];

export function EvidenceGraphView() {
  const [ra, setRa] = useState('127.69444');
  const [dec, setDec] = useState('-39.1776');
  const [bands, setBands] = useState(['SPHEREx-D3', 'SPHEREx-D4', 'SPHEREx-D5']);
  const [report, setReport] = useState<SpherexEvidenceGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<CommunityMetrics | null>(null);
  const [feedbackMetrics, setFeedbackMetrics] = useState<ResearchFeedbackMetrics | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  useEffect(() => {
    void parallaxApi.getCommunityMetrics().then(setMetrics).catch(() => setMetrics(null));
    void parallaxApi.getResearchFeedbackMetrics().then(setFeedbackMetrics).catch(() => setFeedbackMetrics(null));
    const params = new URLSearchParams(window.location.search);
    const sharedRa = params.get('ra');
    const sharedDec = params.get('dec');
    const sharedBands = params.get('bands')?.split(',').filter(Boolean);
    if (sharedRa) setRa(sharedRa);
    if (sharedDec) setDec(sharedDec);
    if (sharedBands && sharedBands.length >= 2) setBands(sharedBands);
  }, []);

  function toggleBand(band: string) {
    setBands((current) => current.includes(band) ? current.filter((item) => item !== band) : [...current, band]);
  }

  async function run() {
    if (bands.length < 2 || !Number.isFinite(Number(ra)) || !Number.isFinite(Number(dec))) {
      setError('Select at least two SPHEREx bands so the evidence chain has a comparison context.');
      return;
    }
    setLoading(true);
    setError(null);
    setShareMessage(null);
    setJobStatus('queued');
    try {
      const request = { ra_deg: Number(ra), dec_deg: Number(dec), bands };
      const queued = await parallaxApi.queueEvidenceGraphSpherex(request);
      setJobStatus(queued.status);
      let latest = queued;
      for (let attempt = 0; attempt < 240; attempt += 1) {
        if (latest.status === 'complete' || latest.status === 'error') break;
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
        latest = await parallaxApi.getEvidenceGraphJob(queued.job_id);
        setJobStatus(latest.status);
      }
      if (latest.status === 'error') throw new Error(latest.error ?? 'The archive job failed.');
      if (!latest.result) throw new Error('The archive job did not finish within the review window.');
      setReport(latest.result);
      const params = new URLSearchParams({ ra, dec, bands: bands.join(',') });
      window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
    } catch (caught) {
      setError(caught instanceof ParallaxApiError ? caught.message : caught instanceof Error ? caught.message : 'The evidence graph is unavailable.');
    } finally {
      setLoading(false);
      setJobStatus(null);
    }
  }

  function downloadEvidence() {
    if (!report) return;
    const payload = { exportedAtUtc: new Date().toISOString(), interpretation: 'Evidence bundle for review; not a discovery claim.', report };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `parallax-x-${ra}-${dec}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setShareMessage('Evidence JSON downloaded.');
  }

  function downloadCsv() {
    if (!report) return;
    const quote = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const rows = [
      ['band', 'status', 'epochs', 'candidate_count', 'screened_count', 'valid_pixel_fraction', 'registration_error', 'cache_hit', 'error'],
      ...report.bands.map((item) => [item.band, item.status, item.epochs.join(' → '), item.candidate_count, item.screened_count, Array.isArray(item.quality.valid_pixel_fraction) ? item.quality.valid_pixel_fraction.join(' / ') : '', item.quality.registration_error ?? '', item.cache_hit ?? false, item.error ?? '']),
    ];
    const csv = rows.map((row) => row.map(quote).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `parallax-x-${ra}-${dec}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setShareMessage('Evidence CSV downloaded.');
  }

  async function copyShareLink() {
    const params = new URLSearchParams({ ra, dec, bands: bands.join(',') });
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareMessage('Review link copied.');
    } catch {
      setShareMessage(url);
    }
  }

  async function sendFeedback(signal: 'useful' | 'unclear' | 'would-share') {
    setFeedbackMessage(null);
    try {
      await parallaxApi.submitResearchFeedback(signal);
      const next = await parallaxApi.getResearchFeedbackMetrics();
      setFeedbackMetrics(next);
      setFeedbackMessage('Pilot feedback recorded in the database.');
    } catch {
      setFeedbackMessage('Feedback is unavailable while the API is offline.');
    }
  }

  return <div className="space-y-6">
    <MissionBrief />
    <JudgeBrief onRun={() => void run()} loading={loading} />
    <section className="panel border-[var(--cyan)]/30 p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-2xl">
          <p className="eyebrow text-[var(--cyan)]">MULTI-BAND EVIDENCE GRAPH</p>
          <h2 className="mt-3 text-2xl font-medium tracking-[-.03em] text-[var(--ink)]">Follow one target through the archive.</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">PARALLAX X keeps each wavelength independent, then joins the provenance into one review chain. A weak band stays visible as weak evidence; it is never averaged into confidence.</p>
        </div>
        <div className="flex items-center gap-2 border border-[var(--cyan)]/30 px-3 py-2 mono text-[9px] uppercase tracking-[.12em] text-[var(--cyan)]"><Network size={13} /> Judge mode / evidence, not certainty</div>
      </div>
      <div className="mt-6 grid gap-3 border-y border-[var(--line)] py-4 text-xs leading-6 text-[var(--muted)] md:grid-cols-3"><div><span className="mono text-[9px] uppercase tracking-[.1em] text-[var(--cyan)]">01 / Query</span><p className="mt-1">One coordinate across multiple public SPHEREx bands.</p></div><div><span className="mono text-[9px] uppercase tracking-[.1em] text-[var(--cyan)]">02 / Gate</span><p className="mt-1">Flags, variance, overlap, and registration are measured before promotion.</p></div><div><span className="mono text-[9px] uppercase tracking-[.1em] text-[var(--cyan)]">03 / Review</span><p className="mt-1">A candidate becomes a review question—not a discovery claim.</p></div></div>
      <div className="mt-7 grid gap-4 md:grid-cols-[1fr_1fr_2fr_auto] md:items-end">
        <Field label="Right ascension (deg)" value={ra} onChange={setRa} />
        <Field label="Declination (deg)" value={dec} onChange={setDec} />
        <div>
          <p className="mono mb-2 text-[9px] uppercase tracking-[.1em] text-[var(--quiet)]">Bands / minimum two</p>
          <div className="flex flex-wrap gap-2">
            {BAND_OPTIONS.map((band) => <label key={band} className={`inline-flex cursor-pointer items-center gap-2 border px-3 py-2 mono text-[9px] uppercase tracking-[.08em] ${bands.includes(band) ? 'border-[var(--signal)]/50 bg-[var(--signal-soft)] text-[var(--signal)]' : 'border-[var(--line)] text-[var(--quiet)]'}`}><input className="sr-only" type="checkbox" checked={bands.includes(band)} onChange={() => toggleBand(band)} />{band.replace('SPHEREx-', '')}</label>)}
          </div>
        </div>
        <button type="button" onClick={() => void run()} disabled={loading} className="focus-ring inline-flex items-center justify-center gap-2 bg-[var(--signal)] px-5 py-3 mono text-[10px] uppercase tracking-[.12em] text-[var(--void)] disabled:opacity-50"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} />{loading ? 'Reading archive…' : 'Run judge brief'}</button>
      </div>
      {error && <p className="mt-5 border border-[var(--amber)]/40 p-4 text-xs leading-6 text-[var(--amber)]">{error}</p>}
    </section>

    {!report && !loading && <section className="grid gap-4 md:grid-cols-3"><InfoCard label="1 / Query" text="One sky position, repeated across selected SPHEREx bands." /><InfoCard label="2 / Gate" text="Every epoch pair is checked for dimensions, flags, overlap, and registration." /><InfoCard label="3 / Review" text="The result preserves provenance, screened residuals, and honest null results." /></section>}
    {loading && <div className="panel p-8 text-sm text-[var(--muted)]">Archive job: <span className="mono text-[var(--cyan)]">{jobStatus ?? 'queued'}</span>. Reading public IRSA products and measuring each selected band independently…</div>}
    {report && <Report report={report} metrics={metrics} feedbackMetrics={feedbackMetrics} feedbackMessage={feedbackMessage} onFeedback={sendFeedback} onDownload={downloadEvidence} onDownloadCsv={downloadCsv} onCopyLink={() => void copyShareLink()} shareMessage={shareMessage} />}
  </div>;
}

const MISSION_STEPS = [
  { number: '01', title: 'Observe', text: 'Read repeated SPHEREx observations with provenance attached.', icon: Eye },
  { number: '02', title: 'Compare', text: 'Align epochs and measure motion or brightness change.', icon: GitCompareArrows },
  { number: '03', title: 'Reject artifacts', text: 'Screen flags, noise, bad pixels, and registration failures.', icon: ShieldX },
  { number: '04', title: 'Cross-band verify', text: 'Check whether the signal persists across independent bands.', icon: Telescope },
  { number: '05', title: 'Send to human review', text: 'Hand an evidence bundle to a researcher or citizen reviewer.', icon: Send },
] as const;

function MissionBrief() {
  return <section className="panel border-[var(--signal)]/35 bg-[linear-gradient(135deg,rgba(237,247,238,.04),rgba(91,214,196,.05))] p-5 sm:p-7" aria-labelledby="mission-brief-title">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-3xl">
        <p className="eyebrow text-[var(--signal)]">MISSION / 30-SECOND BRIEF</p>
        <h2 id="mission-brief-title" className="mt-3 text-2xl font-medium tracking-[-.03em] text-[var(--ink)] sm:text-3xl">Turn repeated sky observations into a trustworthy review queue.</h2>
        <blockquote className="mt-4 border-l-2 border-[var(--signal)] pl-4 text-sm leading-7 text-[var(--muted)] sm:text-base">“PARALLAX X helps researchers and citizens triage possible moving or changing objects in repeated SPHEREx observations without confusing artifacts for discoveries.”</blockquote>
      </div>
      <span className="mono border border-[var(--signal)]/35 px-3 py-2 text-[9px] uppercase tracking-[.12em] text-[var(--signal)]">Problem → evidence → review</span>
    </div>
    <div className="mt-6 grid gap-3 border-y border-[var(--line)] py-4 sm:grid-cols-3">
      <MissionFact label="THE PROBLEM" text="Repeated survey data can hide real change inside noise, detector artifacts, and mis-registration." />
      <MissionFact label="WHO IT SERVES" text="Researchers need triage; citizens need a bounded, explainable way to inspect the same evidence." />
      <MissionFact label="THE OUTCOME" text="A measured, provenance-linked handoff—candidate, null result, or artifact—for human review." />
    </div>
    <div className="mt-6" aria-label="PARALLAX X mission workflow">
      <div className="mb-3 flex items-center justify-between gap-3"><p className="mono text-[9px] uppercase tracking-[.12em] text-[var(--quiet)]">THE REVIEW LOOP</p><p className="mono text-[9px] uppercase tracking-[.1em] text-[var(--cyan)]">No discovery claim without review</p></div>
      <ol className="grid gap-2 md:grid-cols-5">
        {MISSION_STEPS.map(({ number, title, text, icon: Icon }) => <li key={title} className="relative border border-[var(--line)] bg-[var(--surface-2)] p-4 md:min-h-[150px]">
          <div className="flex items-center justify-between gap-2"><span className="mono text-[9px] text-[var(--cyan)]">{number}</span><Icon size={16} aria-hidden="true" className="text-[var(--signal)]" /></div>
          <h3 className="mt-4 text-sm font-medium text-[var(--ink)]">{title}</h3>
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{text}</p>
        </li>)}
      </ol>
    </div>
  </section>;
}

function MissionFact({ label, text }: { label: string; text: string }) {
  return <div className="border-l border-[var(--line-strong)] pl-3"><p className="mono text-[9px] uppercase tracking-[.1em] text-[var(--cyan)]">{label}</p><p className="mt-2 text-xs leading-5 text-[var(--muted)]">{text}</p></div>;
}

function JudgeBrief({ onRun, loading }: { onRun: () => void; loading: boolean }) {
  return <section className="panel border-[var(--cyan)]/35 p-5 sm:p-7" aria-labelledby="judge-brief-title">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow text-[var(--cyan)]">JUDGE BRIEF / 2 MINUTES</p><h2 id="judge-brief-title" className="mt-3 text-2xl font-medium tracking-[-.03em] text-[var(--ink)]">One real archive case, four decisions.</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">Use the prefilled SPHEREx / IRSA target to tell one complete story: start with the repeated observations, show the quality gate, inspect the residual, then stop at the correct human-review conclusion.</p></div><span className="mono border border-[var(--cyan)]/35 px-3 py-2 text-[9px] uppercase tracking-[.12em] text-[var(--cyan)]">REAL DATA / NO DISCOVERY CLAIM</span></div>
    <ol className="mt-6 grid gap-2 md:grid-cols-4">
      <BriefStep number="01" title="Before" text="One sky position, repeated SPHEREx epochs, provenance attached." />
      <BriefStep number="02" title="Quality gate" text="Flags, variance, overlap, and registration are checked before promotion." />
      <BriefStep number="03" title="Residual" text="A measured change, screened artifact, or honest null result stays visible." />
      <BriefStep number="04" title="Conclusion" text="Cross-band context determines the next human-review action—not certainty." />
    </ol>
    <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-5"><button type="button" onClick={onRun} disabled={loading} className="focus-ring inline-flex items-center gap-2 bg-[var(--signal)] px-5 py-3 mono text-[10px] uppercase tracking-[.12em] text-[var(--void)] disabled:opacity-50"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} />{loading ? 'Running real-data case…' : 'Start 2-minute judge brief'}</button><p className="text-xs text-[var(--quiet)]">The evidence is exploratory; a human reviewer decides what happens next.</p></div>
  </section>;
}

function BriefStep({ number, title, text }: { number: string; title: string; text: string }) {
  return <li className="border border-[var(--line)] bg-[var(--surface-2)] p-4"><span className="mono text-[9px] text-[var(--cyan)]">{number}</span><h3 className="mt-3 text-sm font-medium text-[var(--ink)]">{title}</h3><p className="mt-2 text-xs leading-5 text-[var(--muted)]">{text}</p></li>;
}

function Report({ report, metrics, feedbackMetrics, feedbackMessage, onFeedback, onDownload, onDownloadCsv, onCopyLink, shareMessage }: { report: SpherexEvidenceGraph; metrics: CommunityMetrics | null; feedbackMetrics: ResearchFeedbackMetrics | null; feedbackMessage: string | null; onFeedback: (signal: 'useful' | 'unclear' | 'would-share') => void; onDownload: () => void; onDownloadCsv: () => void; onCopyLink: () => void; shareMessage: string | null }) {
  const summary = report.summary;
  return <div className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><Metric label="Bands" value={String(summary.bands_requested)} tone="cyan" /><Metric label="Ready" value={String(summary.bands_ready)} tone="signal" /><Metric label="Caution / blocked" value={`${summary.bands_caution} / ${summary.bands_blocked}`} tone={summary.bands_blocked ? 'amber' : 'cyan'} /><Metric label="Errors" value={String(summary.bands_error)} tone={summary.bands_error ? 'amber' : 'signal'} /><Metric label="Candidates" value={String(summary.total_candidates)} tone="signal" /><Metric label="Consistency" value={summary.consistency_status.replaceAll('_', ' ')} tone={summary.matched_candidate_groups ? 'signal' : 'cyan'} /></div>
    <JudgeConclusion report={report} />
    <section className="panel p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">TARGET EVIDENCE CHAIN</p><h2 className="mt-3 text-xl font-medium text-[var(--ink)]">{report.target.ra_deg.toFixed(5)}°, {report.target.dec_deg.toFixed(5)}°</h2><p className="mt-2 text-xs text-[var(--quiet)]">{report.summary.processing_mode} · {report.summary.elapsed_seconds.toFixed(1)}s total · {report.summary.cache_hits} cache hit(s)</p></div><div className="flex flex-wrap items-center gap-2"><span className="mono border border-[var(--line)] px-3 py-2 text-[9px] uppercase tracking-[.1em] text-[var(--quiet)]">{report.graph.nodes.length} nodes / {report.graph.edges.length} links</span><button type="button" onClick={onCopyLink} className="focus-ring border border-[var(--line-strong)] px-3 py-2 mono text-[9px] uppercase tracking-[.1em] text-[var(--cyan)]">Copy review link</button><button type="button" onClick={onDownload} className="focus-ring bg-[var(--cyan)] px-3 py-2 mono text-[9px] uppercase tracking-[.1em] text-[var(--void)]">Export JSON</button><button type="button" onClick={onDownloadCsv} className="focus-ring border border-[var(--line-strong)] px-3 py-2 mono text-[9px] uppercase tracking-[.1em] text-[var(--cyan)]">Export CSV</button></div></div>
      <div className="mt-6 space-y-3">{report.bands.map((item) => <BandCard key={item.band} item={item} />)}</div>
      {shareMessage && <p className="mt-4 text-xs text-[var(--signal)]">{shareMessage}</p>}
    </section>
    <section className="panel border-[var(--cyan)]/25 p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow text-[var(--cyan)]">CROSS-BAND CONSISTENCY</p><h2 className="mt-3 text-xl font-medium text-[var(--ink)]">{report.cross_band_consistency.status.replaceAll('_', ' ')}</h2></div><span className="mono border border-[var(--line)] px-3 py-2 text-[9px] uppercase tracking-[.1em] text-[var(--quiet)]">{report.cross_band_consistency.matched_groups.length} matched group(s)</span></div><p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)]">{report.cross_band_consistency.method}</p>{report.cross_band_consistency.matched_groups.length > 0 && <div className="mt-5 space-y-2">{report.cross_band_consistency.matched_groups.map((group) => <div key={group.group_id} className="border border-[var(--signal)]/30 bg-[var(--signal-soft)] p-4 text-xs text-[var(--muted)]"><span className="mono text-[var(--signal)]">{group.group_id}</span><span className="ml-3 text-[var(--ink)]">{group.bands.join(' + ')}</span><span className="ml-3">{group.candidate_ids.join(', ')}</span></div>)}</div>}</section>
    <ImpactPath metrics={metrics} />
    <ResearchHandoff feedbackMetrics={feedbackMetrics} feedbackMessage={feedbackMessage} onFeedback={onFeedback} />
    <section className="border-t border-[var(--line)] pt-6"><p className="eyebrow">Interpretation boundary</p><p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)]">This graph makes the evidence auditable across bands. It does not turn agreement into a probability of discovery, and it does not claim that a null result rules out a real object.</p><ul className="mt-4 space-y-2 text-xs leading-6 text-[var(--quiet)]">{report.limitations.map((item) => <li key={item}>· {item}</li>)}</ul></section>
  </div>;
}

function JudgeConclusion({ report }: { report: SpherexEvidenceGraph }) {
  const conclusion = judgeConclusion(report);
  return <section className={`border p-5 sm:p-7 ${conclusion.tone === 'signal' ? 'border-[var(--signal)]/45 bg-[var(--signal-soft)]' : conclusion.tone === 'amber' ? 'border-[var(--amber)]/45 bg-[rgba(243,187,113,.07)]' : 'border-[var(--cyan)]/35 bg-[rgba(141,229,226,.06)]'}`} aria-live="polite"><p className="eyebrow">CASE STUDY CONCLUSION</p><div className="mt-3 flex flex-wrap items-center justify-between gap-4"><h2 className="text-2xl font-medium tracking-[-.03em] text-[var(--ink)] sm:text-3xl">{conclusion.label}</h2><span className="mono border border-current px-3 py-2 text-[9px] uppercase tracking-[.12em]" style={{ color: `var(--${conclusion.tone})` }}>{conclusion.tone === 'signal' ? 'REVIEWABLE' : conclusion.tone === 'amber' ? 'CAUTION' : 'CONTEXT ONLY'}</span></div><p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)]">{conclusion.text}</p><p className="mt-5 border-t border-current/20 pt-4 text-sm font-medium leading-7 text-[var(--ink)]"><span className="mono mr-2 text-[9px] uppercase tracking-[.1em] text-[var(--cyan)]">What should the reviewer do next?</span>{conclusion.next}</p></section>;
}

function judgeConclusion(report: SpherexEvidenceGraph): { label: string; text: string; next: string; tone: 'signal' | 'amber' | 'cyan' } {
  if (report.summary.bands_blocked > 0 || report.summary.bands_error > 0) return { label: 'COMPARISON BLOCKED', text: 'At least one requested band could not support a reliable comparison, so the evidence chain is not ready for interpretation.', next: 'Inspect the blocking quality or archive error, then retry with a compatible epoch pair or remove the failed band.', tone: 'amber' };
  if (report.summary.total_candidates === 0) return { label: 'NO PROMOTED RESIDUAL', text: 'No residual passed the promotion gate in this case. That is a valid null result, not evidence that the sky is empty.', next: 'Keep the null result in the record and stop short of a discovery claim; only reopen it with a new observation or analysis question.', tone: 'cyan' };
  if (report.cross_band_consistency.status.startsWith('MULTI-BAND')) return { label: 'MULTI-BAND CONSISTENT', text: `The evidence graph found ${report.summary.matched_candidate_groups} cross-band group(s) while preserving each band’s independent quality checks.`, next: 'Open the matched candidate group, inspect its provenance and screened alternatives, then send the evidence bundle to human review.', tone: 'signal' };
  return { label: 'SINGLE-BAND ONLY', text: 'A promoted residual is present, but the selected bands did not produce a cross-band match. This remains provisional evidence.', next: 'Treat the candidate as a lead only; inspect the residual and request independent verification before interpreting it.', tone: 'amber' };
}

function BandCard({ item }: { item: SpherexEvidenceGraph['bands'][number] }) {
  const blocked = item.status === 'COMPARISON NOT RELIABLE' || item.status === 'ERROR';
  const ready = item.status === 'READY TO COMPARE';
  const quality = item.quality;
  const valid = Array.isArray(quality.valid_pixel_fraction) ? quality.valid_pixel_fraction.map((value) => typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '—').join(' / ') : '—';
  return <article className="border border-[var(--line)] bg-[var(--surface-2)] p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="mono text-[10px] uppercase tracking-[.12em] text-[var(--cyan)]">{item.band}</p><h3 className="mt-2 text-lg text-[var(--ink)]">{item.candidate_count ? `${item.candidate_count} promoted candidate(s)` : 'Null result / no promoted residual'}</h3></div><span className={`inline-flex items-center gap-1.5 border px-2.5 py-1 mono text-[9px] uppercase tracking-[.08em] ${ready ? 'border-[var(--signal)]/40 text-[var(--signal)]' : blocked ? 'border-[var(--amber)]/40 text-[var(--amber)]' : 'border-[var(--cyan)]/40 text-[var(--cyan)]'}`}>{ready ? <Check size={12} /> : blocked ? <AlertTriangle size={12} /> : <ShieldCheck size={12} />}{item.status}</span></div><div className="mt-4 grid gap-3 text-xs sm:grid-cols-3"><Data label="Epoch chain" value={item.epochs.length ? item.epochs.join(' → ') : item.error ?? 'No usable pair'} /><Data label="Valid pixels" value={valid} /><Data label="Screened" value={String(item.screened_count)} /></div>{item.candidate_count === 0 && <p className="mt-4 text-xs leading-6 text-[var(--quiet)]">Measured, reviewed, and retained as a null result for this band—not evidence that the sky is empty.</p>}{item.error && <p className="mt-4 text-xs leading-6 text-[var(--amber)]">{item.error}</p>}<p className="mt-5 border-t border-[var(--line)] pt-4 text-xs leading-6 text-[var(--ink)]"><span className="mono mr-2 text-[9px] uppercase tracking-[.1em] text-[var(--cyan)]">What should the reviewer do next?</span>{bandNextAction(item)}</p></article>;
}

function bandNextAction(item: SpherexEvidenceBand): string {
  if (item.status === 'COMPARISON NOT RELIABLE') return 'Do not interpret this band; inspect the blocking quality issue or select a compatible epoch pair.';
  if (item.status === 'ERROR') return 'Retry the archive request or verify product availability before using this band as evidence.';
  if (item.candidate_count === 0) return 'Keep this null result as a constraint and do not promote a candidate from this band.';
  if (item.status === 'COMPARE WITH CAUTION') return 'Inspect the caution flags and seek independent verification before relying on this residual.';
  return 'Inspect the promoted residual and compare its provenance and alternatives with the other selected bands.';
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label><span className="mono mb-2 block text-[9px] uppercase tracking-[.1em] text-[var(--quiet)]">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className="focus-ring w-full border border-[var(--line-strong)] bg-[var(--surface-2)] px-3 py-3 text-sm text-[var(--ink)]" inputMode="decimal" /></label>; }
function InfoCard({ label, text }: { label: string; text: string }) { return <div className="panel p-5"><p className="eyebrow text-[var(--cyan)]">{label}</p><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{text}</p></div>; }
function Metric({ label, value, tone }: { label: string; value: string; tone: 'signal' | 'cyan' | 'amber' }) { const color = tone === 'signal' ? 'var(--signal)' : tone === 'cyan' ? 'var(--cyan)' : 'var(--amber)'; return <div className="panel p-4" style={{ borderTopColor: color }}><p className="mono text-[9px] uppercase tracking-[.1em] text-[var(--quiet)]">{label}</p><p className="mt-3 text-2xl font-medium" style={{ color }}>{value}</p></div>; }
function Data({ label, value }: { label: string; value: string }) { return <div className="border border-[var(--line)] p-3"><p className="mono text-[9px] uppercase tracking-[.08em] text-[var(--quiet)]">{label}</p><p className="mt-2 break-words text-xs leading-5 text-[var(--muted)]">{value}</p></div>; }
function ImpactPath({ metrics }: { metrics: CommunityMetrics | null }) { return <section className="panel p-5 sm:p-7"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">IMPACT PATH / MEASURED</p><h2 className="mt-3 text-xl font-medium text-[var(--ink)]">From archive evidence to accountable review.</h2></div><span className="mono border border-[var(--cyan)]/30 px-3 py-2 text-[9px] uppercase tracking-[.1em] text-[var(--cyan)]">No vanity metrics</span></div><div className="mt-6 grid gap-3 md:grid-cols-4"><ImpactStep number="01" title="Observe" text="Read public SPHEREx epochs with attached provenance." /><ImpactStep number="02" title="Screen" text="Keep quality failures and null results visible." /><ImpactStep number="03" title="Review" text="Send only eligible candidates to people." /><ImpactStep number="04" title="Measure" text={metrics ? `${metrics.totalReviews} persisted review(s) / ${metrics.candidatesWithConsensus} consensus record(s).` : 'SQL-backed metrics appear when the API is connected.'} /></div></section>; }
function ImpactStep({ number, title, text }: { number: string; title: string; text: string }) { return <div className="border border-[var(--line)] bg-[var(--surface-2)] p-4"><span className="mono text-[9px] text-[var(--cyan)]">{number}</span><h3 className="mt-3 text-sm text-[var(--ink)]">{title}</h3><p className="mt-2 text-xs leading-5 text-[var(--muted)]">{text}</p></div>; }
function ResearchHandoff({ feedbackMetrics, feedbackMessage, onFeedback }: { feedbackMetrics: ResearchFeedbackMetrics | null; feedbackMessage: string | null; onFeedback: (signal: 'useful' | 'unclear' | 'would-share') => void }) {
  return <section className="panel border-[var(--signal)]/25 p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow text-[var(--signal)]">RESEARCH HANDOFF / PILOT SIGNAL</p><h2 className="mt-3 text-xl font-medium text-[var(--ink)]">Would this evidence desk help your work?</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">A researcher or educator can test the exported bundle and record whether the handoff is useful. These are persisted pilot signals, not claimed adoption.</p></div><span className="mono border border-[var(--signal)]/30 px-3 py-2 text-[9px] uppercase tracking-[.1em] text-[var(--signal)]">{feedbackMetrics?.uniqueParticipants ?? 0}/{feedbackMetrics?.minimumParticipants ?? 5} pilot participants</span></div><div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => onFeedback('useful')} className="focus-ring border border-[var(--line-strong)] px-4 py-3 mono text-[9px] uppercase tracking-[.1em] text-[var(--ink)]">Useful for review</button><button type="button" onClick={() => onFeedback('would-share')} className="focus-ring border border-[var(--line-strong)] px-4 py-3 mono text-[9px] uppercase tracking-[.1em] text-[var(--ink)]">Would share</button><button type="button" onClick={() => onFeedback('unclear')} className="focus-ring border border-[var(--line-strong)] px-4 py-3 mono text-[9px] uppercase tracking-[.1em] text-[var(--muted)]">Needs clarification</button><Link href="/classroom" className="focus-ring border border-[var(--cyan)]/40 px-4 py-3 mono text-[9px] uppercase tracking-[.1em] text-[var(--cyan)]">Open classroom pilot</Link></div>{feedbackMetrics && <p className="mt-4 text-xs text-[var(--quiet)]">Signals: {feedbackMetrics.signals.map((item) => `${item.label} ${item.count}`).join(' · ') || 'none yet'} · status: {feedbackMetrics.pilotStatus}</p>}{feedbackMessage && <p className="mt-2 text-xs text-[var(--signal)]">{feedbackMessage}</p>}</section>;
}
