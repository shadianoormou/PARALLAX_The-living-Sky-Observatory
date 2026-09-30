'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X, ArrowUpRight } from 'lucide-react';
import { LanguageProvider, useLanguage } from './language-context';
import { ModeProvider, useMode, type Audience } from './mode-context';

const primaryNav = [
  { href: '/explore', label: 'Explore' },
  { href: '/candidates', label: 'Sky Mysteries' },
  { href: '/citizen-science', label: 'Citizen Science' },
];

const secondaryNav = [
  { href: '/classroom', label: 'Classroom + Pilot' },
  { href: '/passport', label: 'Discovery Passport' },
  { href: '/science', label: 'Science Methodology' },
  { href: '/validation', label: 'Validation Results' },
  { href: '/spherex', label: 'Live SPHEREx' },
  { href: '/parallax-x', label: 'PARALLAX X' },
  { href: '/provenance', label: 'Data Provenance' },
  { href: '/architecture', label: 'Architecture' },
  { href: '/demo', label: 'Demo Investigation' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return <LanguageProvider><ModeProvider><ShellContent>{children}</ShellContent></ModeProvider></LanguageProvider>;
}

function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { expert, setExpert, audience, setAudience } = useMode();
  const { language, setLanguage, t } = useLanguage();
  const [highContrast, setHighContrast] = useState(false);
  const [largeText, setLargeText] = useState(false);

  useEffect(() => {
    const contrast = window.localStorage.getItem('parallax-high-contrast') === 'true';
    const large = window.localStorage.getItem('parallax-large-text') === 'true';
    setHighContrast(contrast);
    setLargeText(large);
    document.body.dataset.contrast = contrast ? 'high' : 'standard';
    document.body.dataset.fontScale = large ? 'large' : 'standard';
  }, []);

  function toggleAccessibility(setting: 'contrast' | 'large') {
    if (setting === 'contrast') {
      const next = !highContrast;
      setHighContrast(next);
      window.localStorage.setItem('parallax-high-contrast', String(next));
      document.body.dataset.contrast = next ? 'high' : 'standard';
    } else {
      const next = !largeText;
      setLargeText(next);
      window.localStorage.setItem('parallax-large-text', String(next));
      document.body.dataset.fontScale = next ? 'large' : 'standard';
    }
  }

  const labelFor = (item: { href: string; label: string }) => {
    const key = item.href === '/candidates' ? 'nav.mysteries' : item.href === '/citizen-science' ? 'nav.citizen' : item.href === '/classroom' ? 'nav.classroom' : item.href === '/parallax-x' ? 'nav.parallax' : item.href === '/science' ? 'nav.science' : item.href === '/validation' ? 'nav.validation' : '';
    return key ? t(key, item.label) : item.label;
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-screen bg-[var(--void)]">
      <a href="#main-content" className="focus-ring absolute left-4 top-2 z-[60] -translate-y-24 bg-[var(--signal)] px-3 py-2 mono text-[10px] text-[var(--void)] focus:translate-y-0">{t('shell.skip', 'Skip to main content')}</a>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--line)] bg-[rgba(8,11,13,.82)] backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link href="/" className="focus-ring group flex items-center gap-3" onClick={() => setMenuOpen(false)}>
            <span className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-full border border-[var(--line-strong)]">
              <span className="orbital-line absolute h-5 w-8" />
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--signal)] shadow-[0_0_12px_var(--signal)]" />
            </span>
            <span className="mono text-[11px] font-medium tracking-[.22em] text-[var(--ink)]">PARALLAX</span>
          </Link>

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary navigation">
            {primaryNav.map((item) => (
              <Link key={item.href} href={item.href} className={`focus-ring mono text-[10px] uppercase tracking-[.12em] transition-colors hover:text-[var(--signal)] ${isActive(item.href) ? 'text-[var(--signal)]' : 'text-[var(--muted)]'}`}>
                {labelFor(item)}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-1 rounded-full border border-[var(--line)] p-1 sm:flex" role="group" aria-label={t('shell.language', 'Language')}>
              {(['en', 'bn'] as const).map((item) => <button key={item} type="button" aria-pressed={language === item} onClick={() => setLanguage(item)} className={`focus-ring rounded-full px-2 py-1 mono text-[9px] uppercase tracking-[.1em] ${language === item ? 'bg-[var(--signal)] text-[var(--void)]' : 'text-[var(--muted)]'}`}>{item === 'bn' ? 'বাংলা' : 'EN'}</button>)}
            </div>
            <div className="hidden items-center gap-1 rounded-full border border-[var(--line)] p-1 xl:flex" role="group" aria-label={t('shell.audience', 'Audience mode')}>
              {(['citizen', 'teacher', 'researcher'] as Audience[]).map((item) => <button key={item} type="button" aria-pressed={audience === item} onClick={() => setAudience(item)} className={`focus-ring rounded-full px-2 py-1 mono text-[8px] uppercase tracking-[.08em] ${audience === item ? 'bg-[var(--cyan)] text-[var(--void)]' : 'text-[var(--muted)]'}`}>{item}</button>)}
            </div>
            <div className="hidden items-center gap-1 sm:flex" role="group" aria-label="Accessibility settings">
              <button type="button" aria-label={t('shell.largeText', 'Toggle large text')} aria-pressed={largeText} onClick={() => toggleAccessibility('large')} className={`focus-ring rounded border px-2 py-1 mono text-[9px] ${largeText ? 'border-[var(--signal)] text-[var(--signal)]' : 'border-[var(--line)] text-[var(--quiet)]'}`}>A+</button>
              <button type="button" aria-label={t('shell.highContrast', 'Toggle high contrast')} aria-pressed={highContrast} onClick={() => toggleAccessibility('contrast')} className={`focus-ring rounded border px-2 py-1 mono text-[9px] ${highContrast ? 'border-[var(--signal)] text-[var(--signal)]' : 'border-[var(--line)] text-[var(--quiet)]'}`}>HC</button>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-[var(--line)] px-2 py-1.5 sm:flex">
              <span className={`mono text-[9px] uppercase tracking-[.12em] ${!expert ? 'text-[var(--signal)]' : 'text-[var(--quiet)]'}`}>{t('shell.public', 'Public')}</span>
              <button type="button" aria-label="Toggle Expert Mode" aria-pressed={expert} onClick={() => setExpert((value) => !value)} className="focus-ring relative h-4 w-7 rounded-full bg-[var(--surface-2)]">
                <span className={`absolute top-0.5 h-3 w-3 rounded-full transition-all ${expert ? 'left-[15px] bg-[var(--cyan)]' : 'left-0.5 bg-[var(--signal)]'}`} />
              </button>
              <span className={`mono text-[9px] uppercase tracking-[.12em] ${expert ? 'text-[var(--cyan)]' : 'text-[var(--quiet)]'}`}>{t('shell.expert', 'Expert')}</span>
            </div>
            <Link href="/explore?guided=1" className="focus-ring hidden items-center gap-2 rounded-full bg-[var(--signal)] px-4 py-2.5 mono text-[10px] font-medium uppercase tracking-[.12em] text-[var(--void)] transition-transform hover:-translate-y-0.5 sm:flex">
              {t('shell.open', 'Open observatory')} <ArrowUpRight size={13} />
            </Link>
            <button type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen((value) => !value)} className="focus-ring rounded-full border border-[var(--line)] p-2 text-[var(--muted)] lg:hidden">
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="border-t border-[var(--line)] bg-[var(--surface)] px-5 py-5 lg:hidden">
            <div className="mb-5 grid gap-4 border-b border-[var(--line)] pb-5">
              <div className="flex items-center justify-between gap-3"><span className="mono text-[9px] uppercase tracking-[.12em] text-[var(--quiet)]">{t('shell.language', 'Language')}</span><div className="flex gap-1" role="group" aria-label={t('shell.language', 'Language')}>{(['en', 'bn'] as const).map((item) => <button key={item} type="button" aria-pressed={language === item} onClick={() => setLanguage(item)} className={`focus-ring rounded border px-3 py-2 mono text-[9px] uppercase ${language === item ? 'border-[var(--signal)] text-[var(--signal)]' : 'border-[var(--line)] text-[var(--muted)]'}`}>{item === 'bn' ? 'বাংলা' : 'EN'}</button>)}</div></div>
              <label className="flex items-center justify-between gap-3"><span className="mono text-[9px] uppercase tracking-[.12em] text-[var(--quiet)]">{t('shell.audience', 'Audience mode')}</span><select value={audience} onChange={(event) => setAudience(event.target.value as Audience)} className="focus-ring border border-[var(--line-strong)] bg-[var(--surface-2)] px-3 py-2 mono text-[9px] uppercase text-[var(--ink)]"><option value="citizen">Citizen</option><option value="teacher">Teacher</option><option value="researcher">Researcher</option></select></label>
              <div className="flex gap-2"><button type="button" aria-pressed={largeText} aria-label={t('shell.largeText', 'Toggle large text')} onClick={() => toggleAccessibility('large')} className={`focus-ring border px-3 py-2 mono text-[9px] ${largeText ? 'border-[var(--signal)] text-[var(--signal)]' : 'border-[var(--line)] text-[var(--quiet)]'}`}>A+ {t('shell.largeText', 'Large text')}</button><button type="button" aria-pressed={highContrast} aria-label={t('shell.highContrast', 'Toggle high contrast')} onClick={() => toggleAccessibility('contrast')} className={`focus-ring border px-3 py-2 mono text-[9px] ${highContrast ? 'border-[var(--signal)] text-[var(--signal)]' : 'border-[var(--line)] text-[var(--quiet)]'}`}>HC {t('shell.highContrast', 'High contrast')}</button></div>
            </div>
            <div className="grid gap-4">
              {[...primaryNav, ...secondaryNav].map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className={`focus-ring mono text-[11px] uppercase tracking-[.12em] ${isActive(item.href) ? 'text-[var(--signal)]' : 'text-[var(--muted)]'}`}>
                  {labelFor(item)}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>

      <main id="main-content" className="min-h-screen pt-[72px]">{children}</main>
      <footer className="border-t border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <p className="mono text-[10px] uppercase tracking-[.12em] text-[var(--quiet)]">PARALLAX / living sky observatory</p>
          <p className="max-w-md text-right text-xs leading-5 text-[var(--quiet)]">A careful interface for repeated observations. Demonstration measurements remain labeled and traceable. AI-assisted code is disclosed in the project documentation.</p>
        </div>
      </footer>
    </div>
  );
}
