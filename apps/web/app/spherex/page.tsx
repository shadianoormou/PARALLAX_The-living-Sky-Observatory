import { PageIntro } from '../../components/page-intro';
import { RouteFrame } from '../../components/route-frame';
import { SpherexView } from '../../components/spherex/spherex-view';

export default function SpherexPage() {
  return <RouteFrame marker="spherex"><PageIntro eyebrow="09 / Live archive" title="Inspect a real SPHEREx field." body="Query the NASA/IPAC archive, compare two released epochs, and keep the source metadata attached to every measured result." /><SpherexView /></RouteFrame>;
}
