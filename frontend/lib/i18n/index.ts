import { en as enLocale } from './locales/en'
import { ptBR as ptBRLocale } from './locales/pt-BR'

export type Locale = 'en' | 'pt-BR'

// Translations shape mirrors en locale, widening literals to string.
// Recursive to support nested objects like logs.dayTags.
type DeepStrings<T> = {
  readonly [K in keyof T]: T[K] extends Record<string, unknown> ? DeepStrings<T[K]> : string
}

export type Translations = DeepStrings<typeof enLocale>

const LOCALES: Record<Locale, Translations> = {
  'en': enLocale,
  'pt-BR': ptBRLocale,
}

export function getTranslations(locale: Locale): Translations {
  return LOCALES[locale]
}

export const LOCALE_STORAGE_KEY = 'gym-logs-locale'
export const DEFAULT_LOCALE: Locale = 'pt-BR'
