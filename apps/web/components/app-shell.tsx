'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X, ArrowUpRight } from 'lucide-react';
import { ModeProvider, useMode } from './mode-context';

const primaryNav = [
  { href: '/explore', label: 'Explore' },
  { href: '/candidates', label: 'Sky Mysteries' },
  { href: '/citizen-science', label: 'Citizen Science' },
];

const secondaryNav = [
  { href: '/passport', label: 'Discovery Passport' },
  { href: '/science', label: 'Science Methodology' },
  { href: '/validation', label: 'Validation Results' },
  { href: '/spherex', label: 'Live SPHEREx' },
  { href: '/provenance', label: 'Data Provenance' },
  { href: '/architecture', label: 'Architecture' },
  { href: '/demo', label: 'Demo Investigation' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return <ModeProvider><ShellContent>{children}</ShellContent></ModeProvider>;
}

function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { expert, setExpert } = useMode();

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-screen bg-[var(--void)]">
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
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-[var(--line)] px-2 py-1.5 sm:flex">
              <span className={`mono text-[9px] uppercase tracking-[.12em] ${!expert ? 'text-[var(--signal)]' : 'text-[var(--quiet)]'}`}>Public</span>
              <button type="button" aria-label="Toggle Expert Mode" aria-pressed={expert} onClick={() => setExpert((value) => !value)} className="focus-ring relative h-4 w-7 rounded-full bg-[var(--surface-2)]">
                <span className={`absolute top-0.5 h-3 w-3 rounded-full transition-all ${expert ? 'left-[15px] bg-[var(--cyan)]' : 'left-0.5 bg-[var(--signal)]'}`} />
              </button>
              <span className={`mono text-[9px] uppercase tracking-[.12em] ${expert ? 'text-[var(--cyan)]' : 'text-[var(--quiet)]'}`}>Expert</span>
            </div>
            <Link href="/explore?guided=1" className="focus-ring hidden items-center gap-2 rounded-full bg-[var(--signal)] px-4 py-2.5 mono text-[10px] font-medium uppercase tracking-[.12em] text-[var(--void)] transition-transform hover:-translate-y-0.5 sm:flex">
              Open observatory <ArrowUpRight size={13} />
            </Link>
            <button type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen((value) => !value)} className="focus-ring rounded-full border border-[var(--line)] p-2 text-[var(--muted)] lg:hidden">
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="border-t border-[var(--line)] bg-[var(--surface)] px-5 py-5 lg:hidden">
            <div className="grid gap-4">
              {[...primaryNav, ...secondaryNav].map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className={`focus-ring mono text-[11px] uppercase tracking-[.12em] ${isActive(item.href) ? 'text-[var(--signal)]' : 'text-[var(--muted)]'}`}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="min-h-screen pt-[72px]">{children}</main>
      <footer className="border-t border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <p className="mono text-[10px] uppercase tracking-[.12em] text-[var(--quiet)]">PARALLAX / living sky observatory</p>
          <p className="max-w-md text-right text-xs leading-5 text-[var(--quiet)]">A careful interface for repeated observations. Demonstration measurements remain labeled and traceable. AI-assisted code is disclosed in the project documentation.</p>
        </div>
      </footer>
    </div>
  );
}
