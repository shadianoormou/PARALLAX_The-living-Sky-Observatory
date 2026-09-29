import { PageIntro } from '../../components/page-intro';
import { RouteFrame } from '../../components/route-frame';
import { ValidationView } from '../../components/validation/validation-view';

export default function ValidationPage() {
  return <RouteFrame marker="validation"><PageIntro eyebrow="08 / Validation" title="Measure the detector before trusting the story." body="Every candidate interpretation is bounded by regression cases: known motion, brightness change, no-change, artifact rejection, and comparison incompatibility." /><ValidationView /></RouteFrame>;
}
