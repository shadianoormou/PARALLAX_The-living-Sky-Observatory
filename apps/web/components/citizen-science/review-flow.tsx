'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CandidateListItem, CandidateRecord, Consensus, ParallaxApiError, parallaxApi } from '../../lib/parallax-api';

const choices = [
  ['moving_source', 'MOVING SOURCE', 'A position change between observations.'],
  ['brightness_change', 'BRIGHTNESS CHANGE', 'The source changes flux without a clear position shift.'],
  ['imaging_artifact', 'IMAGING ARTIFACT', 'A detector, registration, or processing residual.'],
  ['uncertain', 'UNCERTAIN', 'The evidence is not strong enough to choose.'],
] as const;

const confidenceLevels = ['LOW', 'MEDIUM', 'HIGH'] as const;

export function CitizenScienceReview() {
  const [candidates, setCandidates] = useState<CandidateListItem[]>([]);
  const [index, setIndex] = useState(0);
  const [record, setRecord] = useState<CandidateRecord | null>(null);
  const [label, setLabel] = useState('uncertain');
  const [confidence, setConfidence] = useState<(typeof confidenceLevels)[number] | ''>('');
  const [consensus, setConsensus] = useState<Consensus[] | null>(null);
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidate = candidates[index] ?? null;
  const orderedCandidates = useMemo(() => [...candidates].sort((a, b) => Number(b.status === 'needs_review') - Number(a.status === 'needs_review')), [candidates]);

  useEffect(() => {
    void parallaxApi.listCandidates()
      .then((items) => {
        setCandidates(items);
        setLoading(false);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Candidates could not be loaded.');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!candidate) return;
    setLabel('uncertain');
    setConfidence('');
    setConsensus(null);
    setError(null);
    void parallaxApi.getRecord(candidate.id).then(setRecord).catch(() => setRecord(null));
  }, [candidate]);

  async function submit() {
    if (!candidate) return;
    setSaving(true);
    setError(null);
    try {
      await parallaxApi.submitClassification({ candidate_id: candidate.id, label, confidence: confidence || undefined });
      const nextConsensus = await parallaxApi.getConsensus(candidate.id);
      setConsensus(nextConsensus);
      setReviewed((items) => items.includes(candidate.id) ? items : [...items, candidate.id]);
    } catch (reason: unknown) {
      setError(reason instanceof ParallaxApiError ? reason.message : 'Your classification could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  function nextCandidate() {
    if (!orderedCandidates.length) return;
    const next = orderedCandidates.findIndex((item) => !reviewed.includes(item.id) && item.id !== candidate?.id);
    const fallback = (index + 1) % orderedCandidates.length;
    setCandidates(orderedCandidates);
    setIndex(next >= 0 ? next : fallback);
  }

  if (loading) return <div className="panel p-8 text-sm text-[var(--muted)]">Loading review candidates…</div>;
  if (error && !candidate) return <div className="panel p-8 text-sm text-[var(--amber)]">{error}</div>;
  if (!candidate) return <div className="panel p-8"><p className="eyebrow">No candidates yet</p><p className="mt-4 text-sm leading-7 text-[var(--muted)]">Run the demonstration analysis to create reviewable candidates.</p><Link className="mt-6 inline-block border border-[var(--line-strong)] px-4 py-3 text-xs uppercase tracking-[.14em] text-[var(--ink)]" href="/demo">Open demonstration analysis</Link></div>;

  const totalVotes = consensus?.[0]?.totalVotes ?? 0;
  return (
    <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
      <div className="panel p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-6">
          <div><p className="eyebrow">Candidate {index + 1} / {candidates.length}</p><h2 className="mt-3 text-2xl text-[var(--ink)]">WHAT DO YOU THINK THIS IS?</h2></div>
          <span className="mono border border-[var(--line)] px-3 py-2 text-[10px] uppercase tracking-[.12em] text-[var(--amber)]">DEMONSTRATION DATASET</span>
        </div>
        <div className="mt-7 grid gap-5 md:grid-cols-[1fr_.8fr]">
          <div className="border border-[var(--line)] bg-[var(--surface-2)] p-5">
            <p className="mono text-xs text-[var(--cyan)]">{candidate.candidateKey}</p>
            <p className="mt-6 text-lg leading-8 text-[var(--ink)]">{candidate.interpretation}</p>
            <p className="mt-5 text-sm leading-7 text-[var(--muted)]">The science engine flagged this record for human review. Your vote is a classification of the evidence shown here, not a declaration of discovery.</p>
            {record && <div className="mt-6 border-t border-[var(--line)] pt-5 text-xs leading-6 text-[var(--muted)]"><p>Processing: {record.provenance.algorithmVersion}</p><p>Epochs: {String(record.provenance.epochA.epoch ?? 'A')} / {String(record.provenance.epochB.epoch ?? 'B')}</p><Link className="mt-3 inline-block text-[var(--cyan)]" href={`/candidates/${candidate.id}`}>Inspect full candidate record →</Link></div>}
          </div>
          <div>
            <p className="eyebrow">Choose one classification</p>
            <div className="mt-4 space-y-2">
              {choices.map(([value, title, description]) => <button key={value} type="button" onClick={() => setLabel(value)} className={`focus-ring w-full border p-4 text-left transition ${label === value ? 'border-[var(--signal)] bg-[var(--signal-soft)]' : 'border-[var(--line)] bg-[var(--surface-2)]'}`}><span className="mono text-[10px] tracking-[.12em] text-[var(--ink)]">{title}</span><span className="mt-2 block text-xs leading-5 text-[var(--muted)]">{description}</span></button>)}
            </div>
            <p className="eyebrow mt-7">Optional confidence</p>
            <div className="mt-4 flex gap-2">{confidenceLevels.map((level) => <button key={level} type="button" onClick={() => setConfidence(confidence === level ? '' : level)} className={`focus-ring border px-3 py-2 text-[10px] tracking-[.12em] ${confidence === level ? 'border-[var(--cyan)] text-[var(--cyan)]' : 'border-[var(--line)] text-[var(--muted)]'}`}>{level}</button>)}</div>
            <button type="button" disabled={saving} onClick={() => void submit()} className="mt-7 w-full bg-[var(--signal)] px-5 py-4 text-xs font-semibold uppercase tracking-[.14em] text-[var(--void)] disabled:opacity-50">{saving ? 'Saving…' : reviewed.includes(candidate.id) ? 'Update classification' : 'Submit classification'}</button>
            {error && <p className="mt-4 text-xs leading-5 text-[var(--amber)]">{error}</p>}
          </div>
        </div>
      </div>
      <div className="space-y-5">
        {consensus ? <div className="panel p-6 sm:p-8"><p className="eyebrow">Community opinion</p><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{totalVotes} reviewer{totalVotes === 1 ? '' : 's'} so far. This is community opinion, not scientific truth.</p><div className="mt-6 space-y-4">{consensus.map((item) => <div key={item.classificationLabel}><div className="mb-2 flex justify-between gap-4 text-xs"><span className="text-[var(--ink)]">{item.classificationLabel.replaceAll('_', ' ')}</span><span className="mono text-[var(--cyan)]">{Math.round(item.agreementFraction * 100)}%</span></div><div className="h-2 bg-[var(--surface-2)]"><div className="h-full bg-[var(--cyan)]" style={{ width: `${item.agreementFraction * 100}%` }} /></div></div>)}</div></div> : <div className="panel p-6 sm:p-8"><p className="eyebrow">Consensus is gated</p><p className="mt-4 text-sm leading-7 text-[var(--muted)]">Submit your own classification before seeing how other reviewers responded.</p></div>}
        <div className="panel p-6 sm:p-8"><p className="eyebrow">Review desk</p><p className="mt-4 text-sm leading-7 text-[var(--muted)]">Your review is saved against this candidate. Submitting again updates your existing vote rather than creating a duplicate.</p><button type="button" onClick={nextCandidate} className="mt-6 border border-[var(--line-strong)] px-4 py-3 text-xs uppercase tracking-[.14em] text-[var(--ink)]">Next candidate →</button><Link className="ml-4 text-xs uppercase tracking-[.14em] text-[var(--cyan)]" href="/passport">View passport</Link></div>
      </div>
    </div>
  );
}
