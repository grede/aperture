import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aperture - Screenshot Management',
  description: 'AI-powered app store screenshot automation',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
