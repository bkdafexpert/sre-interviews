import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Sgcut — Raccourcisseur d'URL",
  description:
    'Raccourcissez vos URLs, partagez-les partout, et mesurez chaque clic : sources, appareils, pays.',
  icons: { icon: '/logo-mark-red.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
