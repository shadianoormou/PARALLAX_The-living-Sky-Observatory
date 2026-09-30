import { PageIntro } from '../../components/page-intro';
import { EvidenceGraphView } from '../../components/parallax-x/evidence-graph-view';
import { RouteFrame } from '../../components/route-frame';

export default function ParallaxXPage() {
  return <RouteFrame marker="parallax x"><PageIntro eyebrow="10 / PARALLAX X" title="The sky changed. Now show why." body="A multi-band SPHEREx evidence graph that keeps quality, provenance, null results, and candidate review in the same line of sight." /><EvidenceGraphView /></RouteFrame>;
}
