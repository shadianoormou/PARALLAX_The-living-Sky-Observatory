import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return <section className="observatory-grid min-h-[calc(100vh-72px)] px-5 py-24 sm:px-8 lg:px-12"><div className="mx-auto max-w-[1440px]"><p className="eyebrow">404 / off the map</p><h1 className="mt-6 max-w-xl text-6xl font-medium tracking-[-.06em] text-[var(--ink)]">This coordinate has no observation.</h1><Link href="/" className="focus-ring mt-10 inline-flex items-center gap-2 mono text-[10px] uppercase tracking-[.14em] text-[var(--signal)]"><ArrowLeft size={14} /> Return to the observatory</Link></div></section>;
}
