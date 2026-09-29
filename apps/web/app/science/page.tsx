import { ScienceModules } from '../../components/science/science-modules';
import { PageIntro } from '../../components/page-intro';
import { RouteFrame } from '../../components/route-frame';

export default function SciencePage() {
  return <RouteFrame marker="methodology"><PageIntro eyebrow="05 / Science Methodology" title="The method is part of the experience." body="PARALLAX keeps registration, measurement, interpretation, and human review visibly separate. A candidate is a measured lead that still needs verification." /><div className="mb-5 panel p-6 sm:p-8"><p className="eyebrow">How the pipeline reasons</p><p className="mt-5 max-w-4xl text-sm leading-8 text-[var(--muted)]">The science engine registers two observation epochs, normalizes their photometry, computes a difference image, detects residual components, measures their displacement or brightness change, and carries uncertainty and quality flags into the API. Detector defects, bad pixels, cosmic rays, and imperfect registration can all create false positives. Human review helps triage those alternatives; it does not turn a candidate into a discovery.</p><span className="mt-6 inline-block mono border border-[var(--line)] px-3 py-2 text-[10px] uppercase tracking-[.12em] text-[var(--amber)]">DEMONSTRATION DATASET</span></div><ScienceModules /></RouteFrame>;
}
