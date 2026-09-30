import { ClassroomMode } from '../../components/classroom/classroom-mode';
import { PageIntro } from '../../components/page-intro';
import { RouteFrame } from '../../components/route-frame';

export default function ClassroomPage() {
  return <RouteFrame marker="classroom + pilot"><PageIntro eyebrow="11 / CLASSROOM + PILOT" title="Turn evidence review into a teachable, measurable activity." body="A five-step lesson mode for astronomy students, teachers, and researchers—followed by persisted pilot feedback and an aggregate reviewer consensus report." /><ClassroomMode /></RouteFrame>;
}
