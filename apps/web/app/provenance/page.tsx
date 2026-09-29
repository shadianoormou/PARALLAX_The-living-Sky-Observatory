import { ProvenanceView } from '../../components/provenance/provenance-view';
import { PageIntro } from '../../components/page-intro';
import { RouteFrame } from '../../components/route-frame';

export default function ProvenancePage() {
  return <RouteFrame marker="data provenance"><PageIntro eyebrow="06 / Data Provenance" title="Every view should answer: where did this come from?" body="The selected candidate carries its dataset identity, observation epochs, coordinate frame, bands, processing run, algorithm version, and source type through the API." /><ProvenanceView /></RouteFrame>;
}
