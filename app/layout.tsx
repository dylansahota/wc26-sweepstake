import type { Metadata } from 'next'
import { Manrope, Space_Grotesk } from 'next/font/google'
import './globals.css'

const sans = Manrope({
  variable: '--font-sans',
  subsets: ['latin'],
})

const display = Space_Grotesk({
  variable: '--font-display',
  subsets: ['latin'],
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
