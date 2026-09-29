import { CitizenScienceReview } from '../../components/citizen-science/review-flow';
import { PageIntro } from '../../components/page-intro';
import { RouteFrame } from '../../components/route-frame';

export default function CitizenSciencePage() {
  return <RouteFrame marker="citizen science"><PageIntro eyebrow="03 / Citizen Science" title="A second set of eyes, with context." body="Review the evidence, state what you think it is, and then compare your classification with the community. Consensus is a review signal, not scientific truth." /><CitizenScienceReview /></RouteFrame>;
}
