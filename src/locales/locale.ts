import { ref } from 'vue'

export const LOCALES = ['en', 'ru', 'uk'] as const
export type Locale = (typeof LOCALES)[number]

export const FALLBACK_LOCALE: Locale = 'en'

const STORAGE_KEY = 'wod.locale.v1'

function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

function detectInitial(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isLocale(stored)) return stored
  } catch {
    // localStorage can throw in private mode — fall through to detection
  }
  const preferred =
    typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language])
  for (const tag of preferred) {
    const prefix = tag.toLowerCase().split('-')[0]
    if (isLocale(prefix)) return prefix
  }
  return FALLBACK_LOCALE
}

export const currentLocale = ref<Locale>(detectInitial())

function syncDocumentLang(): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = currentLocale.value
  }
}

export function setLocale(next: Locale): void {
  currentLocale.value = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // ignore persistence failures — the choice still applies for this session
  }
  syncDocumentLang()
}

syncDocumentLang()
