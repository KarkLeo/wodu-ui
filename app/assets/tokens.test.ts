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

function hexToRgb(hex: string): number[] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
}

function rgbToHex(rgb: number[]): string {
  return '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
}

// `color-mix(in srgb, X p%, transparent)` over a background is the same as mixing X into that background.
function fillOver(declaration: string, bg: string): string {
  const mix = declaration.match(/color-mix\(in srgb, var\(--vtt-([a-z-]+)\) (\d+)%, (transparent|var\(--vtt-([a-z-]+)\))\)/)
  if (mix) {
    const p = Number(mix[2]) / 100
    const [fg, under] = [hexToRgb(tokens[mix[1]]), hexToRgb(tokens[mix[4] ?? bg])]
    return rgbToHex(fg.map((v, i) => v * p + under[i] * (1 - p)))
  }
  const plain = declaration.match(/^var\(--vtt-([a-z-]+)\)$/)
  if (!plain) throw new Error(`unsupported background: ${declaration}`)
  return tokens[plain[1]]
}

describe('Pill tones', () => {
  const pillCss = readFileSync(resolve(__dirname, '../components/ui/Pill.vue'), 'utf8')
  const block = (selector: string) => {
    const body = pillCss.match(new RegExp(`\\n${selector.replace('.', '\\.')} \\{([^}]*)\\}`))?.[1] ?? ''
    const values = (prop: string) => [...body.matchAll(new RegExp(`(?:^|[;\\s])${prop}:\\s*([^;]+);`, 'g'))].map((m) => m[1].trim())
    return { color: values('color'), background: values('background') }
  }
  const base = block('.pill')
  const tones = {
    neutral: base,
    accent: { ...base, ...pick(block('.is-accent')) },
    danger: { ...base, ...pick(block('.is-danger')) },
  }
  function pick(b: { color: string[]; background: string[] }) {
    return Object.fromEntries(Object.entries(b).filter(([, v]) => v.length))
  }

  // Every background declaration counts: the plain-token fallback is what older Safari draws.
  const cases = Object.entries(tones).flatMap(([tone, { color, background }]) =>
    background.flatMap((fill) => BACKGROUNDS.map((bg) => [tone, color.at(-1)!, fill, bg])),
  )

  it('reads every tone from Pill.vue', () => {
    for (const { color, background } of Object.values(tones)) {
      expect(color.length).toBeGreaterThan(0)
      expect(background.length).toBeGreaterThan(0)
    }
  })

  it.each(cases)('%s text (%s) on %s over %s meets WCAG AA', (_tone, color, fill, bg) => {
    const text = tokens[color.match(/^var\(--vtt-([a-z-]+)\)$/)![1]]
    expect(contrast(text, fillOver(fill, bg))).toBeGreaterThanOrEqual(4.5)
  })
})

const BUTTON_FACE_TOKENS =['hero-face', 'hero-face-hover', 'hero-ink', 'primary-hover']

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
