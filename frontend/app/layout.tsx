import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { QueryProvider } from '@/providers/query-provider'
import { I18nProvider } from '@/providers/i18n-provider'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'gym-logs',
  description: 'Log workouts. Track progression. Own your performance.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
          <I18nProvider>
            <QueryProvider>
              {children}
              <Toaster position="top-right" closeButton duration={30000} />
            </QueryProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
