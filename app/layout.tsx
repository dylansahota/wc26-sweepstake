import type { Metadata } from 'next'
import { Outfit, Oswald } from 'next/font/google'
import './globals.css'

const sans = Outfit({
  variable: '--font-sans',
  subsets: ['latin'],
})

const display = Oswald({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'WC26 Sweepstake',
  description: 'World Cup 2026 snake draft sweepstake tracker',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  )
}
