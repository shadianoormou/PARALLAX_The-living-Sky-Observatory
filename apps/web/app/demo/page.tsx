import { DemoInvestigation } from '../../components/demo/demo-investigation';
import { PageIntro } from '../../components/page-intro';
import { RouteFrame } from '../../components/route-frame';

export default function DemoPage() {
  return <RouteFrame marker="guided investigation"><PageIntro eyebrow="08 / Demo Investigation" title="A three-minute path from sky to evidence." body="Run the real demonstration pipeline, move through the evidence in presenter-controlled steps, submit a classification, and finish with the provenance trail." /><DemoInvestigation /></RouteFrame>;
}
