import { messages as en, type Messages } from './en'
import { messages as ru } from './ru'
import { currentLocale, FALLBACK_LOCALE, type Locale } from './locale'

const DICTIONARIES: Record<Locale, Messages> = {
  en,
  ru,
  // uk is added in the task that introduces the Ukrainian dictionary
  uk: en,
}

type Primitive = string | number | boolean

type DeepKeyOf<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends Primitive
    ? `${Prefix}${K}`
    : T[K] extends object
      ? DeepKeyOf<T[K], `${Prefix}${K}.`>
      : never
}[keyof T & string]

export type MessageKey = DeepKeyOf<Messages>

export type Param = string | number | { $key: MessageKey }

export interface LabelRef {
  key: MessageKey
  params?: Record<string, Param>
}

function resolve(dict: Messages, path: string): string | undefined {
  const parts = path.split('.')
  let node: unknown = dict
  for (const part of parts) {
    if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return typeof node === 'string' ? node : undefined
}

function interpolate(template: string, params?: Record<string, Param>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    if (!(key in params)) return match
    const value = params[key]
    if (typeof value === 'object' && value !== null && '$key' in value) return t(value.$key)
    return String(value)
  })
}

export function t(key: MessageKey, params?: Record<string, Param>): string {
  const value =
    resolve(DICTIONARIES[currentLocale.value], key) ?? resolve(DICTIONARIES[FALLBACK_LOCALE], key)
  if (value === undefined) {
    if (import.meta.env.DEV) {
      console.warn(`[i18n] Missing translation for key: "${key}"`)
    }
    return key
  }
  return interpolate(value, params)
}

export function tLabel(ref: LabelRef): string {
  return t(ref.key, ref.params)
}

export { currentLocale, setLocale, LOCALES, type Locale } from './locale'
