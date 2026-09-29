import { PassportView } from '../../components/passport/passport-view';
import { PageIntro } from '../../components/page-intro';
import { RouteFrame } from '../../components/route-frame';

export default function PassportPage() {
  return <RouteFrame marker="discovery passport"><PageIntro eyebrow="04 / Discovery Passport" title="A record of your questions, not a trophy cabinet." body="Your passport is derived from persisted reviews, community comparisons, regions explored, and learning modules completed. It is a record of participation, not a score." /><PassportView /></RouteFrame>;
}
