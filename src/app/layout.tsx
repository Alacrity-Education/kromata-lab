import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kromata Lab',
  description: 'Drop in images, try palettes, judge the results.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
