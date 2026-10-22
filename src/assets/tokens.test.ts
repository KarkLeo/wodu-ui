import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const css = readFileSync(resolve(__dirname, 'main.css'), 'utf8')
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
