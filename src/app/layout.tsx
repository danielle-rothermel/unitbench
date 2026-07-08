import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Fira_Code, Hanken_Grotesk, Space_Grotesk } from 'next/font/google'
import AppShell from '@/components/AppShell'
import { cn } from '@/lib/cn'
import { getTableConfigs } from '@/lib/table-config'
import '@dr-code/viewer/styles.css'
import './globals.css'

const display = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display-src',
  display: 'swap',
})

const sans = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans-src',
  display: 'swap',
})

const mono = Fira_Code({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono-src',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Unitbench',
  description: 'Experiment result viewers for Unitbench.',
}

type RootLayoutProps = {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="en"
      className={cn(display.variable, sans.variable, mono.variable)}
    >
      <body>
        <AppShell tables={getTableConfigs()}>{children}</AppShell>
      </body>
    </html>
  )
}
