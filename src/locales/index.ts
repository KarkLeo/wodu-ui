import { messages } from './ru'

type Primitive = string | number | boolean

type DeepKeyOf<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends Primitive
    ? `${Prefix}${K}`
    : T[K] extends object
      ? DeepKeyOf<T[K], `${Prefix}${K}.`>
      : never
}[keyof T & string]

export type MessageKey = DeepKeyOf<typeof messages>

function resolve(path: string): string | undefined {
  const parts = path.split('.')
  let node: unknown = messages
  for (const part of parts) {
    if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return typeof node === 'string' ? node : undefined
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match
  )
}

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const value = resolve(key)
  if (value === undefined) {
    if (import.meta.env.DEV) {
      console.warn(`[i18n] Missing translation for key: "${key}"`)
    }
    return key
  }
  return interpolate(value, params)
}
