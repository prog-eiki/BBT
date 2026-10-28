import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BigBlackTea (BBT) – PREMIER TEAM HQ',
  description:
    'Offizielles VALORANT Teamportal für BigBlackTea (BBT) – Map-Strategien, Team-Aufstellungs-Editor mit 1920×1080 PNG-Export, Spielerstatistiken und Gegner-Scouting.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#07080A',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className="dark">
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=Rajdhani:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#07080A] text-[#ECE8E1] antialiased selection:bg-[#9E141B] selection:text-[#C8A273]">
        {children}
      </body>
    </html>
  );
}
