import { PageIntro } from '../../components/page-intro';
import { EvidenceGraphView } from '../../components/parallax-x/evidence-graph-view';
import { RouteFrame } from '../../components/route-frame';

export default function ParallaxXPage() {
  return <RouteFrame marker="parallax x"><PageIntro eyebrow="10 / PARALLAX X" title="The sky changed. Now show why." body="PARALLAX X helps researchers and citizens triage possible moving or changing objects in repeated SPHEREx observations without confusing artifacts for discoveries." /><EvidenceGraphView /></RouteFrame>;
}
