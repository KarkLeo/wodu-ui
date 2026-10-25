import { ClientResponseError } from 'pocketbase'
import { LOCALES, type Locale } from '@/locales'
import type { AppMode } from './mode'

export const OTP_LENGTH = 8
export const OTP_TTL_MS = 180_000
export const RESEND_COOLDOWN_MS = 60_000
export const NAME_MAX = 40

export type AuthGate = 'sign-in' | 'name' | 'none'

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

export function isPlausibleEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function sanitizeCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, OTP_LENGTH)
}

export function defaultDisplayName(email: string): string {
  return email.split('@')[0]!.trim().slice(0, NAME_MAX)
}

export function isNotUniqueEmailError(err: unknown): boolean {
  if (!(err instanceof ClientResponseError)) return false
  const data = err.response?.data as { email?: { code?: string } } | undefined
  return data?.email?.code === 'validation_not_unique'
}

export function isAuthRejected(err: unknown): boolean {
  return err instanceof ClientResponseError && [401, 403, 404].includes(err.status)
}

function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value)
}

export function resolveLanguage(profile: string, device: Locale): { apply: Locale; writeBack: boolean } {
  return isLocale(profile) ? { apply: profile, writeBack: false } : { apply: device, writeBack: true }
}

export function authGate(mode: AppMode, signedIn: boolean, name: string): AuthGate {
  if (mode === 'offline') return 'none'
  if (!signedIn) return 'sign-in'
  return name ? 'none' : 'name'
}
