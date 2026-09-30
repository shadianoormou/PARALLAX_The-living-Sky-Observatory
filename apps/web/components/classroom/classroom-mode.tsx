'use client';

import Link from 'next/link';
import { BookOpen, Check, ClipboardCheck, Copy, Download, ExternalLink, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLanguage } from '../language-context';
import { ConsensusReport, ResearchFeedbackMetrics, parallaxApi } from '../../lib/parallax-api';

type Role = 'student' | 'teacher' | 'researcher';
type Signal = 'useful' | 'unclear' | 'would-share';
type PilotRegion = 'unspecified' | 'south-asia' | 'north-america' | 'europe' | 'latin-america' | 'africa' | 'oceania' | 'other';

const LESSONS = [
  { key: 'registration', title: 'Observe', text: 'Open the field and identify what was observed, when, and from which source.', prompt: 'What evidence is measured before anyone interprets the sky?', href: '/explore' },
  { key: 'differencing', title: 'Compare', text: 'Compare repeated epochs and separate displacement from brightness change.', prompt: 'Which change survives a controlled epoch comparison?', href: '/parallax-x' },
  { key: 'false-positives', title: 'Reject artifacts', text: 'Inspect flags, shape, variance, registration, and null results before promotion.', prompt: 'What alternative explanation must be rejected?', href: '/validation' },
  { key: 'candidate-vs-discovery', title: 'Human review', text: 'Classify one candidate with confidence, then reveal the community view.', prompt: 'Why is a candidate not the same thing as a discovery?', href: '/citizen-science' },
  { key: 'uncertainty', title: 'Report consensus', text: 'Read the aggregate reviewer report and export the evidence handoff.', prompt: 'What does agreement support—and what does it not prove?', href: '#consensus-report' },
] as const;

export function ClassroomMode() {
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState<string[]>([]);
  const [participantCode, setParticipantCode] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [region, setRegion] = useState<PilotRegion>('unspecified');
  const [identitySaved, setIdentitySaved] = useState(false);
  const [metrics, setMetrics] = useState<ResearchFeedbackMetrics | null>(null);
  const [report, setReport] = useState<ConsensusReport | null>(null);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { language } = useLanguage();

  async function refreshImpact() {
    const [nextMetrics, nextReport] = await Promise.all([
      parallaxApi.getResearchFeedbackMetrics(),
      parallaxApi.getConsensusReport(),
    ]);
    setMetrics(nextMetrics);
    setReport(nextReport);
  }

  useEffect(() => {
    const stored = window.localStorage.getItem('parallax-demo-user');
    if (stored) {
      setParticipantCode(stored.replace(/^pilot:/, ''));
      setIdentitySaved(true);
    }
    void refreshImpact().catch(() => setMessage('Impact metrics are unavailable while the API is offline.'));
  }, []);

  function saveIdentity() {
    const normalized = participantCode.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 48);
    if (!normalized) {
      setMessage('Enter an anonymous participant code before submitting pilot feedback.');
      return;
    }
    window.localStorage.setItem('parallax-demo-user', `pilot:${normalized}`);
    setParticipantCode(normalized);
    setIdentitySaved(true);
    setMessage('Pilot identity saved locally. No email or name is collected.');
  }

  async function submitFeedback() {
    if (!identitySaved || !signal) {
      setMessage('Save your anonymous participant code and choose one feedback signal first.');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await parallaxApi.submitResearchFeedback(signal, notes.trim() || undefined, role, language, region);
      await refreshImpact();
      setMessage('Pilot feedback recorded in the SQL-backed research log.');
      setNotes('');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Pilot feedback could not be recorded.');
    } finally {
      setSaving(false);
    }
  }

  async function completeLesson() {
    const current = LESSONS[step];
    if (!completed.includes(current.key)) {
      setCompleted((items) => [...items, current.key]);
      await parallaxApi.completeLearningModule(current.key).catch(() => undefined);
    }
    setStep((value) => Math.min(LESSONS.length - 1, value + 1));
  }

  function exportImpactReport() {
    const payload = { exportedAtUtc: new Date().toISOString(), interpretation: 'Pilot and consensus summary; not an adoption claim.', pilot: metrics, consensus: report };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'parallax-impact-pilot-report.json';
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage('Impact report downloaded.');
  }

  const current = LESSONS[step];
  const participantProgress = `${metrics?.uniqueParticipants ?? 0}/${metrics?.minimumParticipants ?? 5} minimum participants`;
  return <div className="space-y-6">
    <section className="panel border-[var(--signal)]/30 p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow text-[var(--signal)]">REAL-WORLD IMPACT / PILOT PROTOCOL</p><h2 className="mt-3 text-2xl font-medium text-[var(--ink)]">Run a small, honest astronomy learning pilot.</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">Invite 5–10 astronomy students, teachers, or researchers to complete the lesson, classify evidence, and record whether the handoff is useful. The dashboard reports persisted participation; it never fills gaps with simulated adoption.</p></div><span className="mono border border-[var(--signal)]/30 px-3 py-2 text-[9px] uppercase tracking-[.1em] text-[var(--signal)]">{participantProgress}</span></div>
      <div className="mt-6 grid gap-3 border-t border-[var(--line)] pt-5 sm:grid-cols-3"><PilotStat label="Minimum" value={metrics?.minimumParticipants ?? 5} detail="distinct pilot participants" /><PilotStat label="Recommended" value={metrics?.recommendedParticipants ?? 10} detail="student / teacher target" /><PilotStat label="Status" value={metrics?.pilotStatus ?? 'not-started'} detail="based on persisted feedback" /></div>
    </section>

    <GlobalPilotDashboard metrics={metrics} />

    <section className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
      <div className="panel p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow text-[var(--cyan)]">CLASSROOM LESSON MODE</p><h2 className="mt-3 text-xl font-medium text-[var(--ink)]">{current.title}</h2></div><span className="mono text-[9px] uppercase tracking-[.1em] text-[var(--quiet)]">{String(step + 1).padStart(2, '0')} / {String(LESSONS.length).padStart(2, '0')}</span></div><div className="mt-5 flex gap-1" aria-label="Lesson progress">{LESSONS.map((lesson, index) => <button key={lesson.key} type="button" aria-label={`Open lesson ${index + 1}: ${lesson.title}`} onClick={() => setStep(index)} className={`h-1.5 flex-1 ${completed.includes(lesson.key) ? 'bg-[var(--signal)]' : index === step ? 'bg-[var(--cyan)]' : 'bg-[var(--surface-2)]'}`} />)}</div><div className="mt-7 border border-[var(--line)] bg-[var(--surface-2)] p-5"><p className="text-base leading-7 text-[var(--ink)]">{current.text}</p><p className="mt-5 border-t border-[var(--line)] pt-4 text-xs leading-6 text-[var(--muted)]"><span className="mono text-[9px] uppercase tracking-[.1em] text-[var(--cyan)]">Discussion prompt · </span>{current.prompt}</p></div><div className="mt-5 flex flex-wrap items-center gap-3"><Link href={current.href} className="focus-ring inline-flex items-center gap-2 border border-[var(--line-strong)] px-4 py-3 mono text-[9px] uppercase tracking-[.1em] text-[var(--cyan)]">Open activity <ExternalLink size={13} /></Link><button type="button" onClick={() => void completeLesson()} className="focus-ring inline-flex items-center gap-2 bg-[var(--signal)] px-4 py-3 mono text-[9px] uppercase tracking-[.1em] text-[var(--void)]"><Check size={13} /> {completed.includes(current.key) ? 'Completed · next step' : 'Mark lesson complete'}</button></div></div>
      <PilotIdentity participantCode={participantCode} setParticipantCode={(value) => { setParticipantCode(value); setIdentitySaved(false); }} role={role} setRole={setRole} identitySaved={identitySaved} onSave={saveIdentity} />
    </section>

    <section className="panel border-[var(--cyan)]/25 p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow text-[var(--cyan)]">RESEARCHER FEEDBACK / PERSISTED</p><h2 className="mt-3 text-xl font-medium text-[var(--ink)]">Was this useful beyond the demo?</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Choose one signal after completing the lesson. Add a short note if you are a teacher or researcher who can explain the classroom or research context.</p></div><Users className="text-[var(--cyan)]" size={20} /></div><div className="mt-6 grid gap-2 sm:grid-cols-3">{(['useful', 'unclear', 'would-share'] as Signal[]).map((item) => <button key={item} type="button" onClick={() => setSignal(item)} className={`focus-ring border p-4 text-left mono text-[10px] uppercase tracking-[.1em] ${signal === item ? 'border-[var(--signal)] bg-[var(--signal-soft)] text-[var(--signal)]' : 'border-[var(--line)] text-[var(--muted)]'}`}>{item.replace('-', ' ')}</button>)}</div><label className="mt-4 block"><span className="mono mb-2 block text-[9px] uppercase tracking-[.1em] text-[var(--quiet)]">Broad region / optional, no exact location</span><select value={region} onChange={(event) => setRegion(event.target.value as PilotRegion)} className="focus-ring w-full border border-[var(--line-strong)] bg-[var(--surface-2)] px-3 py-3 text-sm text-[var(--ink)]"><option value="unspecified">Prefer not to say</option><option value="south-asia">South Asia</option><option value="north-america">North America</option><option value="europe">Europe</option><option value="latin-america">Latin America</option><option value="africa">Africa</option><option value="oceania">Oceania</option><option value="other">Other</option></select></label><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional: what worked, confused you, or would make this classroom-ready?" className="focus-ring mt-4 min-h-24 w-full resize-y border border-[var(--line-strong)] bg-[var(--surface-2)] p-3 text-sm leading-6 text-[var(--ink)] placeholder:text-[var(--quiet)]" aria-label="Pilot feedback notes" /><div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" disabled={saving} onClick={() => void submitFeedback()} className="focus-ring inline-flex items-center gap-2 bg-[var(--signal)] px-4 py-3 mono text-[9px] uppercase tracking-[.1em] text-[var(--void)] disabled:opacity-50"><ClipboardCheck size={13} /> {saving ? 'Recording…' : 'Record pilot signal'}</button>{message && <p className="text-xs text-[var(--signal)]" role="status">{message}</p>}</div></section>

    <section id="consensus-report" className="panel p-5 sm:p-7"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">REVIEWER CONSENSUS REPORT</p><h2 className="mt-3 text-xl font-medium text-[var(--ink)]">Aggregate opinion, separated from science.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">This report exposes only persisted label counts and agreement. It does not identify reviewers and does not turn agreement into truth.</p></div><button type="button" onClick={exportImpactReport} className="focus-ring inline-flex items-center gap-2 border border-[var(--line-strong)] px-3 py-2 mono text-[9px] uppercase tracking-[.1em] text-[var(--cyan)]"><Download size={13} /> Export impact report</button></div>{report && <div className="mt-6 grid gap-3 sm:grid-cols-4"><PilotStat label="Reviewed" value={report.candidatesReviewed} detail="candidate records" /><PilotStat label="Votes" value={report.totalVotes} detail="persisted classifications" /><PilotStat label="Consensus" value={report.candidatesWithConsensus} detail="candidate records" /><PilotStat label="Agreement" value={`${Math.round(report.averageAgreement * 100)}%`} detail="mean winning fraction" /></div>}{report?.items.length ? <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[680px] border-collapse text-left"><thead><tr className="border-b border-[var(--line)] mono text-[9px] uppercase tracking-[.1em] text-[var(--quiet)]"><th className="px-3 py-3">Candidate</th><th className="px-3 py-3">Evidence label</th><th className="px-3 py-3">Reviewer labels</th><th className="px-3 py-3">Agreement</th></tr></thead><tbody>{report.items.map((item) => <tr key={item.candidateId} className="border-b border-[var(--line)] text-xs"><td className="px-3 py-4 text-[var(--ink)]">{item.candidateKey}</td><td className="px-3 py-4 text-[var(--muted)]">{item.scientificClassification.replaceAll('_', ' ')}</td><td className="px-3 py-4 text-[var(--muted)]">{item.labels.map((label) => `${label.label.replaceAll('_', ' ')} (${label.count})`).join(' · ')}</td><td className="px-3 py-4 mono text-[var(--cyan)]">{item.leadingLabel ? `${Math.round(item.agreementFraction * 100)}% · ${item.leadingLabel.replaceAll('_', ' ')}` : 'pending'}</td></tr>)}</tbody></table></div> : <div className="mt-6 border border-[var(--line)] bg-[var(--surface-2)] p-5 text-sm leading-7 text-[var(--muted)]">No persisted reviewer classifications yet. Complete the classroom activity and submit at least one review before interpreting consensus.</div>}</section>
  </div>;
}

function GlobalPilotDashboard({ metrics }: { metrics: ResearchFeedbackMetrics | null }) {
  const list = (items: Array<{ label: string; count: number }> | undefined) => items?.length ? items.map((item) => `${item.label}: ${item.count}`).join(' · ') : 'No persisted signals yet';
  return <section className="panel border-[var(--signal)]/25 p-5 sm:p-7" aria-labelledby="global-pilot-title"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow text-[var(--signal)]">GLOBAL USABILITY / AGGREGATED PILOT DASHBOARD</p><h2 id="global-pilot-title" className="mt-3 text-xl font-medium text-[var(--ink)]">Measure reach without overstating adoption.</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">Language and broad-region categories are self-reported, optional, and aggregated. Exact location, names, and email are never collected.</p></div><span className="mono border border-[var(--signal)]/30 px-3 py-2 text-[9px] uppercase tracking-[.1em] text-[var(--signal)]">{metrics?.uniqueParticipants ?? 0} anonymous participant(s)</span></div><div className="mt-6 grid gap-3 md:grid-cols-3"><DashboardCell label="Languages / ভাষা" value={list(metrics?.languages)} /><DashboardCell label="Broad regions" value={list(metrics?.regions)} /><DashboardCell label="Roles" value={list(metrics?.roles)} /></div></section>;
}

function DashboardCell({ label, value }: { label: string; value: string }) { return <div className="border border-[var(--line)] bg-[var(--surface-2)] p-4"><p className="mono text-[9px] uppercase tracking-[.1em] text-[var(--quiet)]">{label}</p><p className="mt-3 text-xs leading-6 text-[var(--muted)]">{value}</p></div>; }

function PilotIdentity({ participantCode, setParticipantCode, role, setRole, identitySaved, onSave }: { participantCode: string; setParticipantCode: (value: string) => void; role: Role; setRole: (value: Role) => void; identitySaved: boolean; onSave: () => void }) {
  return <section className="panel p-5 sm:p-7"><div className="flex items-start gap-3"><BookOpen className="mt-1 text-[var(--signal)]" size={20} /><div><p className="eyebrow">PILOT IDENTITY</p><h2 className="mt-3 text-xl font-medium text-[var(--ink)]">One anonymous code per participant.</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Use a class code such as <span className="mono text-[var(--cyan)]">astro-01</span>. It stays in this browser and lets the report count distinct reviewers without collecting names or email.</p></div></div><label className="mt-6 block"><span className="mono mb-2 block text-[9px] uppercase tracking-[.1em] text-[var(--quiet)]">Anonymous participant code</span><input value={participantCode} onChange={(event) => setParticipantCode(event.target.value)} placeholder="astro-01" className="focus-ring w-full border border-[var(--line-strong)] bg-[var(--surface-2)] px-3 py-3 text-sm text-[var(--ink)]" /></label><label className="mt-4 block"><span className="mono mb-2 block text-[9px] uppercase tracking-[.1em] text-[var(--quiet)]">Pilot role</span><select value={role} onChange={(event) => setRole(event.target.value as Role)} className="focus-ring w-full border border-[var(--line-strong)] bg-[var(--surface-2)] px-3 py-3 text-sm text-[var(--ink)]"><option value="student">Astronomy student</option><option value="teacher">Teacher / facilitator</option><option value="researcher">Researcher</option></select></label><button type="button" onClick={onSave} className="focus-ring mt-5 inline-flex items-center gap-2 border border-[var(--line-strong)] px-4 py-3 mono text-[9px] uppercase tracking-[.1em] text-[var(--cyan)]">{identitySaved ? 'Update pilot identity' : 'Save pilot identity'} <Copy size={13} /></button></section>;
}

function PilotStat({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <div className="border border-[var(--line)] bg-[var(--surface-2)] p-4"><p className="mono text-[9px] uppercase tracking-[.1em] text-[var(--quiet)]">{label}</p><p className="mt-2 text-xl font-medium text-[var(--ink)]">{value}</p><p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">{detail}</p></div>;
}
