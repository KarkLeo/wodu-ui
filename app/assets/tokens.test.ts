import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { relative, resolve } from 'node:path'

const mainCss = resolve(__dirname, 'main.css')
const css = readFileSync(mainCss, 'utf8')
const tokens = Object.fromEntries(
  [...css.matchAll(/--vtt-([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map(([, name, hex]) => [name, hex]),
)

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const TEXT_TOKENS = [
  'accent', 'accent-soft', 'accent-deep', 'danger-bright', 'success', 'warning', 'info',
  'text-primary', 'text-secondary', 'text-muted',
]
const BACKGROUNDS = ['bg-base', 'bg-surface', 'bg-elevated', 'bg-sunken']

describe('design tokens', () => {
  it.each(TEXT_TOKENS.flatMap((fg) => BACKGROUNDS.map((bg) => [fg, bg])))(
    '%s on %s meets WCAG AA for normal text',
    (fg, bg) => {
      expect(tokens[fg], `--vtt-${fg} is defined`).toBeDefined()
      expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(4.5)
    },
  )
})

const BUTTON_FACE_TOKENS = ['hero-face', 'hero-face-hover', 'hero-ink', 'primary-hover']

describe('button face tokens', () => {
  const appDir = resolve(__dirname, '..')
  const files = readdirSync(appDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => resolve(entry.parentPath, entry.name))
    .filter((file) => file !== mainCss)

  it.each(BUTTON_FACE_TOKENS)('--vtt-%s is defined only in main.css', (name) => {
    const hex = tokens[name]
    expect(hex, `--vtt-${name} is defined`).toBeDefined()
    const copies = files.filter((file) => readFileSync(file, 'utf8').toLowerCase().includes(hex.toLowerCase()))
    expect(copies.map((file) => relative(appDir, file))).toEqual([])
  })
})
