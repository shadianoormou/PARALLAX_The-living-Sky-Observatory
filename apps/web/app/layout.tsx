import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '../components/app-shell';

export const metadata: Metadata = {
  title: 'PARALLAX — The Living Sky Observatory',
  description: 'A careful interface for comparing repeated views of the sky.',
  keywords: ['NASA', 'SPHEREx', 'IRSA', 'time-domain astronomy', 'citizen science'],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
