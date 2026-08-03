'use client'
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { type Locale, type Translations, getTranslations, LOCALE_STORAGE_KEY, DEFAULT_LOCALE } from '@/lib/i18n'

interface I18nContextValue {
  locale: Locale
  t: Translations
  setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  t: getTranslations(DEFAULT_LOCALE),
  setLocale: () => {},
})

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Always start with DEFAULT_LOCALE — safe for SSR (server never sees localStorage)
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  // After mount (client only), read stored preference
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null
      if (stored === 'en' || stored === 'pt-BR') {
        setLocaleState(stored)
      }
    } catch {
      // localStorage not available (private mode etc.)
    }
  }, [])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next)
    } catch {
      // ignore
    }
  }, [])

  return (
    <I18nContext.Provider value={{ locale, t: getTranslations(locale), setLocale }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}
