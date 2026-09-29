'use client';

import { useState } from 'react';
import { parallaxApi } from '../../lib/parallax-api';

const modules = [
  ['registration', 'Registration', 'Align epochs into one coordinate frame before comparing pixels.'],
  ['normalization', 'Normalization', 'Correct scale and background differences so change is not just exposure drift.'],
  ['differencing', 'Differencing', 'Subtract aligned, normalized epochs to expose residual change.'],
  ['detection', 'Detection', 'Measure connected residuals against a background-noise threshold.'],
  ['measurement', 'Measurement', 'Record displacement, flux change, shape, and uncertainty as separate evidence.'],
  ['uncertainty', 'Uncertainty', 'Carry registration error, noise, and threshold context into every interpretation.'],
  ['false-positives', 'False positives', 'Treat detector defects, cosmic rays, bad pixels, and registration residuals as alternatives.'],
  ['candidate-vs-discovery', 'Candidate ≠ discovery', 'A candidate is a lead for review; independent verification is still required.'],
] as const;

export function ScienceModules() {
  const [completed, setCompleted] = useState<string[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  async function complete(key: string) {
    setSaving(key);
    try { await parallaxApi.completeLearningModule(key); setCompleted((items) => items.includes(key) ? items : [...items, key]); } finally { setSaving(null); }
  }
  return <div className="grid gap-4 md:grid-cols-2">{modules.map(([key, title, body], index) => <div key={key} className="panel p-6"><p className="eyebrow">{String(index + 1).padStart(2, '0')} / {title}</p><p className="mt-5 text-sm leading-7 text-[var(--muted)]">{body}</p><button type="button" onClick={() => void complete(key)} disabled={saving === key || completed.includes(key)} className="mt-6 border border-[var(--line-strong)] px-4 py-3 text-[10px] uppercase tracking-[.14em] text-[var(--ink)] disabled:cursor-default disabled:border-[var(--signal)] disabled:text-[var(--signal)]">{completed.includes(key) ? 'Module completed' : saving === key ? 'Saving…' : 'Mark module complete'}</button></div>)}</div>;
}
