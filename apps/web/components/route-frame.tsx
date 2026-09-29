export function RouteFrame({ children, marker }: { children: React.ReactNode; marker?: string }) {
  return (
    <section className="observatory-grid relative min-h-[calc(100vh-72px)] overflow-hidden px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-10 flex items-center justify-between border-b border-[var(--line)] pb-4">
          <span className="mono text-[10px] uppercase tracking-[.16em] text-[var(--quiet)]">PARALLAX / {marker ?? 'observatory'}</span>
          <span className="mono text-[10px] uppercase tracking-[.16em] text-[var(--quiet)]">status: foundation</span>
        </div>
        {children}
      </div>
    </section>
  );
}
