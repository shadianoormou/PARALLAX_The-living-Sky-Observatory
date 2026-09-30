import { CandidateDetail } from '../../../components/candidates/candidate-detail';

export function generateStaticParams() {
  return [{ id: 'precomputed-PX-DEMO-017' }];
}

export default function CandidateDetailRoute() {
  return <CandidateDetail />;
}
