import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Urbanist } from 'next/font/google';

import './globals.css';

const urbanist = Urbanist({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-urbanist', display: 'swap' });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-inter', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['500'], variable: '--font-jetbrains', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'CosmicPulse', template: '%s · CosmicPulse' },
  description: 'AI-assisted astronaut health monitoring — personal baselines, spaceflight risk intelligence and NASA research evidence. Not a medical device.',
  applicationName: 'CosmicPulse',
  manifest: '/manifest.webmanifest',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#05080D',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/** Before first paint: set the theme (no flash) and open every visit on the landing film. */
const THEME_SCRIPT = `try{var s=JSON.parse(localStorage.getItem('cosmicpulse.settings.v1')||'{}').state||{};var t=s.theme||'dark';if(t==='system'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t;if(s.motion==='reduced')document.documentElement.dataset.motion='reduced';var p=location.pathname;var landed=false;try{landed=sessionStorage.getItem('cp.landed')==='1'}catch(e){}if(!landed&&p.indexOf('/intro')!==0&&p.indexOf('/welcome')!==0&&p.indexOf('/emergency')!==0){document.documentElement.style.background='#000';location.replace('/intro')}}catch(e){document.documentElement.dataset.theme='dark'}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${urbanist.variable} ${inter.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
