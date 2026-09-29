export function PageIntro({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="mb-10 max-w-3xl">
      <p className="eyebrow mb-5">{eyebrow}</p>
      <h1 className="text-4xl font-medium tracking-[-.045em] text-[var(--ink)] sm:text-6xl">{title}</h1>
      <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--muted)] sm:text-lg">{body}</p>
    </div>
  );
}
