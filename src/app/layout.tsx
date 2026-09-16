import type { Metadata } from 'next'
import { Archivo, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import { Starfield } from '@/components/starfield'
import './globals.css'

// Archivo carries a width axis; the expanded end gives headings the
// institutional look the design calls for.
const archivo = Archivo({
  variable: '--font-archivo',
  subsets: ['latin'],
  axes: ['wdth'],
})

const plexSans = IBM_Plex_Sans({
  variable: '--font-plex-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  title: 'TV-Watcher',
  description:
    'Follow a show or film once. We text you the moment the next one actually drops.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body className="min-h-dvh text-[15px] leading-[1.6]">
        <Starfield />
        <div className="relative z-[1]">{children}</div>
      </body>
    </html>
  )
}
