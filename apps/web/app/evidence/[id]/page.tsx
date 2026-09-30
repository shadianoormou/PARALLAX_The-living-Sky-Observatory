import { PublicEvidenceView } from '../../../components/public-evidence/public-evidence-view';
import { PageIntro } from '../../../components/page-intro';
import { RouteFrame } from '../../../components/route-frame';

export function generateStaticParams() {
  return [{ id: 'demo' }];
}

export default async function PublicEvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RouteFrame marker="PUBLIC EVIDENCE / READ-ONLY"><PageIntro eyebrow="Public evidence" title="A shareable, immutable handoff for review." body="Anyone with the link can inspect the evidence payload. The public view never exposes editing or classification controls." /><PublicEvidenceView id={id} /></RouteFrame>;
}
