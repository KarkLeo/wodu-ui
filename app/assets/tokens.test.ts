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
  const toneNames = [...pillCss.matchAll(/\n\.is-([a-z]+) \{/g)].map((m) => m[1])
  const tones = {
    neutral: base,
    ...Object.fromEntries(toneNames.map((name) => [name, { ...base, ...pick(block(`.is-${name}`)) }])),
  }
  function pick(b: { color: string[]; background: string[] }) {
    return Object.fromEntries(Object.entries(b).filter(([, v]) => v.length))
  }

  // Every background declaration counts: the plain-token fallback is what older Safari draws.
  const cases = Object.entries(tones).flatMap(([tone, { color, background }]) =>
    background.flatMap((fill) => BACKGROUNDS.map((bg) => [tone, color.at(-1)!, fill, bg])),
  )

  it('reads every tone from Pill.vue', () => {
    expect(toneNames).toEqual(expect.arrayContaining(['accent', 'danger']))
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

const APP_DIR = resolve(__dirname, '..')
const SOURCES = readdirSync(APP_DIR, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.(vue|css|ts)$/.test(entry.name) && !entry.name.endsWith('.test.ts'))
  .map((entry) => resolve(entry.parentPath, entry.name))
const ROOT_BLOCK = /:root\s*\{[^}]*\}/

/** What a guard reads of a file: main.css without its :root block, since that is where literals belong. */
function source(file: string): string {
  const text = readFileSync(file, 'utf8')
  return file === mainCss ? text.replace(ROOT_BLOCK, '') : text
}

function styleBlocks(file: string): string {
  if (file.endsWith('.css')) return source(file)
  if (!file.endsWith('.vue')) return ''
  return [...source(file).matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n')
}

function occurrences(read: (file: string) => string, pattern: RegExp): string[] {
  return SOURCES.flatMap((file) => [...read(file).matchAll(pattern)].map((m) => `${relative(APP_DIR, file)}: ${m[0].trim()}`))
}

describe('colour literals', () => {
  it('rgba() and friends appear only in the :root block of main.css', () => {
    expect(SOURCES).toContain(mainCss)
    expect(occurrences(source, /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/gi)).toEqual([])
  })

  it('inside :root, a literal rgba() is a tint token, a shadow or a glow', () => {
    const lines = css.match(ROOT_BLOCK)![0].split('\n').filter((line) => line.includes('rgba('))
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.filter((line) => !/^\s*--(?:vtt|shadow|glow)-[a-z0-9-]+:/.test(line))).toEqual([])
  })

  it('no hex colour anywhere under app/, outside the :root block of main.css and the console colours of logger.ts', () => {
    const notLogger = (file: string) => (file.endsWith('utils/logger.ts') ? '' : source(file))
    expect(occurrences(notLogger, /(?:^|[^\w&-])#[0-9a-fA-F]{3,8}\b/gm)).toEqual([])
  })
})

describe('var(--vtt-*)', () => {
  it('every one used under app/ is defined in main.css', () => {
    const defined = new Set([...css.matchAll(/--vtt-([a-z0-9-]+)\s*:/g)].map((m) => m[1]))
    // Raw text on purpose: this also reads -webkit- copies, inline style strings, templates and fallbacks, which the browser never reports.
    const used = occurrences((file) => readFileSync(file, 'utf8'), /var\(\s*--vtt-[\w-]+/gi)
    expect(used.length).toBeGreaterThan(100)
    expect(used.filter((hit) => !defined.has(hit.split('--vtt-')[1]))).toEqual([])
  })
})

/** Each family is one colour at many alphas. A family named after a token cannot drift from it. */
const TINT_FAMILIES: Record<string, { base: string } | { rgb: number[] }> = {
  gold: { base: 'border-gold' },
  accent: { base: 'accent' },
  'accent-soft': { base: 'accent-soft' },
  sunken: { base: 'bg-sunken' },
  base: { base: 'bg-base' },
  surface: { base: 'bg-surface' },
  elevated: { base: 'bg-elevated' },
  danger: { base: 'danger' },
  'danger-soft': { base: 'danger-soft' },
  warning: { base: 'warning' },
  'border-strong': { base: 'border-strong' },
  black: { rgb: [0, 0, 0] },
  'danger-glow': { rgb: [178, 59, 79] },
  'success-glow': { rgb: [107, 142, 78] },
  'info-glow': { rgb: [90, 122, 142] },
}
const PLAIN_TINTS = ['toast-error-border']

const tints = Object.fromEntries(
  [...css.matchAll(/--vtt-([a-z0-9-]+): rgba\((\d+), (\d+), (\d+), (\d(?:\.\d+)?)\);/g)].map(([, name, ...rgba]) => [name, rgba.map(Number)]),
)

describe('alpha tokens', () => {
  const names = Object.keys(tints).filter((name) => !PLAIN_TINTS.includes(name))

  it('are all written rgba(r, g, b, a)', () => {
    const declared = [...css.matchAll(/--vtt-([a-z0-9-]+):\s*rgba\(|--vtt-([a-z0-9-]+-a\d+):/g)].map((m) => m[1] ?? m[2])
    expect(declared.length).toBeGreaterThan(0)
    expect(declared.filter((name) => !(name in tints))).toEqual([])
  })

  it.each(names)('--vtt-%s matches its family and its name', (name) => {
    const [, familyName, percent] = name.match(/^(.+)-a(\d{2,3})$/) ?? []
    const family = TINT_FAMILIES[familyName]
    expect(family, `${name} belongs to a family`).toBeDefined()
    const rgb = 'base' in family ? hexToRgb(tokens[family.base]) : family.rgb
    expect(tints[name].slice(0, 3)).toEqual(rgb)
    expect(Number(percent)).toBeCloseTo(tints[name][3] * 100, 8)
    expect(percent).toBe(String(Number(percent)).padStart(2, '0'))
  })
})

/** One flat fill, or the stops of a gradient: every stop has to pass. */
type Fill = string | string[]

interface TintRow {
  on: string
  text: string[]
  /** Top first. */
  fills: Fill[]
  /** `page` is bg-base under the gradients on `body`. */
  /** `any` computes over a white pixel. An opaque fill holds whatever is behind it; a patch that fades holds only at its solid centre. */
  over: 'page' | 'bg-surface' | 'bg-elevated' | 'artwork' | 'any'
  /**
   * The real backdrop under these fills is the artwork. The number is for the page instead, since an image
   * cannot be computed here; `over: 'artwork'` has no number at all. The rendered audit covers both.
   */
  artwork?: true
}

const SHEET: Fill = ['elevated-a78', 'surface-a82']
const WIZARD: Fill[] = [['surface-a62', 'base-a70'], 'sunken-a35']
const EQUIPPED: Fill = ['gold-a06', 'transparent']
// The two gradients on `body` start at opposite ends and have faded out by the time they cross.
const BODY: Fill = ['gold-a08', 'danger-a06', 'transparent']

const TINT_ROWS: TintRow[] = [
  { on: 'body', fills: [], over: 'page', text: ['text-primary', 'text-secondary', 'text-muted'] },

  // Directly on the artwork: only the rendered audit can tell.
  { on: '.as-shell', fills: [['sunken-a55', 'sunken-a35', 'sunken-a82']], over: 'artwork', text: ['text-primary', 'text-secondary', 'text-muted', 'accent-deep', 'danger-bright'] },
  { on: '.gl-shell', fills: [['sunken-a35', 'sunken-a15', 'sunken-a55']], over: 'artwork', text: ['text-primary', 'text-secondary', 'text-muted'] },
  { on: '.gl-top', fills: [['sunken-a72', 'sunken-a00'], ['sunken-a35', 'sunken-a15', 'sunken-a55']], over: 'artwork', text: ['text-primary', 'text-secondary'] },
  { on: '.cl-shell', fills: [['sunken-a78', 'sunken-a62', 'sunken-a86']], over: 'artwork', text: ['text-primary', 'text-secondary', 'text-muted'] },

  // What sits on the bright sky of the sign-in screens. The patch fades, and text can reach past this number: only the rendered audit sees that.
  { on: '.as-brand::before', fills: ['sunken-a86'], over: 'any', text: ['accent-soft', 'text-secondary'] },
  { on: '.auth-back', fills: ['bg-sunken'], over: 'any', text: ['text-secondary'] },
  { on: '.segmented', fills: ['bg-sunken'], over: 'any', text: ['text-muted'] },

  // Panels on the artwork.
  { on: '.gl-left::before, .gl-right::before, .gl-mob-topbar::before', fills: ['sunken-a78'], over: 'page', artwork: true, text: ['text-primary', 'text-muted', 'accent', 'danger-bright'] },
  { on: '.mob-side', fills: ['sunken-a62'], over: 'page', artwork: true, text: ['text-primary', 'text-secondary', 'text-muted', 'accent', 'accent-deep'] },
  { on: '.ch', fills: ['base-a88'], over: 'page', artwork: true, text: ['text-primary', 'text-secondary', 'text-muted'] },
  { on: '.ch-link:hover', fills: ['accent-soft-a03', 'base-a88'], over: 'page', artwork: true, text: ['text-secondary'] },
  { on: '.as-card, .sdo-card', fills: ['surface-a96'], over: 'page', artwork: true, text: ['text-primary', 'text-muted', 'danger-bright'] },

  // Popovers, sheets and toasts: they float over anything, and are nearly opaque.
  { on: '.bottom-sheet', fills: ['surface-a94'], over: 'page', text: ['text-primary', 'text-muted', 'accent-deep'] },
  { on: '.bs-foot', fills: ['base-a30', 'surface-a94'], over: 'page', text: ['text-secondary'] },
  { on: '.info-popover, .hp-popover', fills: ['elevated-a96'], over: 'page', text: ['text-primary', 'text-secondary', 'text-muted', 'danger-bright'] },
  { on: '.pop-effect-delta.is-buff, popover', fills: ['success-glow-a10', 'elevated-a96'], over: 'page', text: ['success'] },
  { on: '.pop-effect-delta.is-buff, sheet', fills: ['success-glow-a10', 'surface-a94'], over: 'page', text: ['success'] },
  { on: '.pop-effect-delta.is-debuff, popover', fills: ['danger-glow-a10', 'elevated-a96'], over: 'page', text: ['danger-bright'] },
  { on: '.pop-effect-delta.is-debuff, sheet', fills: ['danger-glow-a10', 'surface-a94'], over: 'page', text: ['danger-bright'] },
  { on: '.xp-popover', fills: ['surface-a88'], over: 'page', text: ['text-primary', 'text-secondary', 'text-muted', 'accent'] },
  { on: '.xp-pop-levelup', fills: ['accent-a06', 'surface-a88'], over: 'page', text: ['text-primary', 'accent'] },
  { on: '.gm-menu', fills: ['surface-a98'], over: 'page', text: ['text-secondary'] },
  { on: '.gm-item[data-highlighted]', fills: ['accent-a06', 'surface-a98'], over: 'page', text: ['text-primary'] },
  { on: '.pwa-prompt', fills: ['surface-a96'], over: 'page', text: ['text-primary', 'accent'] },
  { on: '.pwa-prompt__action:hover', fills: ['gold-a20', 'surface-a96'], over: 'page', text: ['accent'] },
  { on: '.toast', fills: ['surface-a96'], over: 'page', text: ['text-primary', 'toast-error-text'] },

  // The dice drawer, in the side panel on the artwork. The rail's older values fade further, which only the audit sees.
  { on: '.dice-row, .log-row, .mode-chip, .qr-chip, .v-roll', fills: ['elevated-a55'], over: 'page', artwork: true, text: ['text-primary', 'text-secondary', 'text-muted', 'accent', 'accent-deep'] },
  { on: '.dice-row:hover, .log-row:hover', fills: ['elevated-a72'], over: 'page', artwork: true, text: ['text-primary', 'text-secondary', 'text-muted', 'accent-deep'] },
  { on: '.dice-row-result, .log-row-delta', fills: ['sunken-a45', 'elevated-a55'], over: 'page', artwork: true, text: ['text-primary'] },
  { on: '.dice-row-result, .log-row-delta, hovered row', fills: ['sunken-a45', 'elevated-a72'], over: 'page', artwork: true, text: ['text-primary'] },
  { on: '.dice-row.is-crit, .log-row.is-levelup', fills: [['gold-a20', 'elevated-a55']], over: 'page', artwork: true, text: ['text-primary', 'text-secondary', 'text-muted', 'accent-deep'] },
  { on: '.dice-row.is-fail', fills: ['danger-a18'], over: 'page', artwork: true, text: ['text-primary', 'text-secondary', 'text-muted', 'warning'] },
  { on: '.dice-row.is-fail .dice-row-result', fills: ['danger-a18', 'danger-a18'], over: 'page', artwork: true, text: ['danger-bright'] },
  { on: '.log-row.is-hp-damage .log-row-delta', fills: ['danger-a18', 'elevated-a55'], over: 'page', artwork: true, text: ['danger-bright'] },
  { on: '.log-row.is-hp-damage .log-row-delta, hovered row', fills: ['danger-a18', 'elevated-a72'], over: 'page', artwork: true, text: ['danger-bright'] },
  { on: '.log-row.is-hp-heal .log-row-delta', fills: ['success-glow-a15', 'elevated-a55'], over: 'page', artwork: true, text: ['success'] },
  { on: '.log-row.is-hp-heal .log-row-delta, hovered row', fills: ['success-glow-a15', 'elevated-a72'], over: 'page', artwork: true, text: ['success'] },
  { on: '.mode-chip:hover, .cl-install:hover', fills: ['gold-a15'], over: 'page', artwork: true, text: ['accent'] },
  { on: '.mode-chip.is-armed', fills: ['gold-a25'], over: 'page', artwork: true, text: ['accent'] },
  { on: '.qr-chip:hover, .v-roll:hover', fills: ['gold-a20'], over: 'page', artwork: true, text: ['accent'] },
  { on: '.qr-chip.is-highlight', fills: ['gold-a25'], over: 'page', artwork: true, text: ['accent'] },
  { on: '.dice-input input', fills: ['sunken-a55'], over: 'page', artwork: true, text: ['text-primary'] },
  { on: '.rh-value', fills: ['sunken-a45'], over: 'page', artwork: true, text: ['text-primary', 'accent', 'danger-bright'] },
  { on: '.rh-value.is-fail', fills: ['danger-a18'], over: 'page', artwork: true, text: ['danger-bright'] },

  // The sheet, on the artwork.
  { on: '.sheet-column', fills: [SHEET], over: 'page', artwork: true, text: ['text-primary', 'text-secondary', 'text-muted', 'accent', 'accent-deep'] },
  { on: '.status-chip:hover', fills: ['accent-soft-a03', SHEET], over: 'page', artwork: true, text: ['text-primary', 'text-muted'] },
  { on: '.status-chip .sc-mod.is-buff', fills: ['success-glow-a10', SHEET], over: 'page', artwork: true, text: ['success'] },
  { on: '.status-chip .sc-mod.is-debuff', fills: ['danger-soft-a90', SHEET], over: 'page', artwork: true, text: ['danger-bright'] },
  { on: '.hp-effect-chip', fills: ['surface-a70', SHEET], over: 'page', artwork: true, text: ['text-muted', 'danger-bright'] },
  { on: '.inv-item.is-equipped', fills: [EQUIPPED, SHEET], over: 'page', artwork: true, text: ['text-primary', 'text-muted'] },
  { on: '.equipped-mark, .item-stat-chip.is-price', fills: ['gold-a08', EQUIPPED, SHEET], over: 'page', artwork: true, text: ['accent'] },
  { on: '.inv-use:hover', fills: ['gold-a15'], over: 'bg-surface', text: ['text-primary'] },
  { on: '.item-stat-chip.is-price, unequipped', fills: ['gold-a08'], over: 'bg-surface', text: ['accent'] },
  { on: '.stat-chip .sc-mod', fills: ['surface-a55'], over: 'bg-surface', text: ['text-primary'] },
  { on: '.stat-chip .sc-mod.is-buff', fills: ['success-glow-a15'], over: 'bg-surface', text: ['success'] },
  { on: '.stat-chip .sc-mod.is-debuff', fills: ['danger-soft-a55'], over: 'bg-surface', text: ['danger-bright'] },
  { on: '.stat-chip .sc-mod.is-buff, hovered or active chip', fills: ['success-glow-a15'], over: 'bg-elevated', text: ['success'] },
  { on: '.stat-chip .sc-mod.is-debuff, hovered or active chip', fills: ['danger-soft-a55'], over: 'bg-elevated', text: ['danger-bright'] },
  { on: '.qs-counter.is-overdose', fills: [['danger-a14', 'bg-surface']], over: 'page', artwork: true, text: ['text-secondary', 'danger-bright'] },
  { on: '.spirit-sigil', fills: [['gold-a15', 'transparent']], over: 'bg-surface', text: ['accent'] },
  { on: '.tab-item:hover', fills: ['accent-soft-a03'], over: 'bg-surface', text: ['text-secondary'] },
  { on: '.v-danger-ghost:hover', fills: ['danger-glow-a06'], over: 'bg-surface', text: ['danger-bright'] },

  // The wizard, on the artwork from the tablet up.
  { on: '.wz-shell', fills: WIZARD, over: 'page', artwork: true, text: ['text-primary', 'text-secondary', 'text-muted', 'accent-deep'] },
  { on: '.wz-dot', fills: ['elevated-a55', ...WIZARD], over: 'page', artwork: true, text: ['text-muted'] },
  { on: '.cc-hp, .lu-hp-result', fills: ['elevated-a45', ...WIZARD], over: 'page', artwork: true, text: ['text-primary', 'text-secondary', 'text-muted', 'accent-deep'] },
  { on: '.lu-sum-pill', fills: ['success-glow-a15', ...WIZARD], over: 'page', artwork: true, text: ['success'] },
  { on: '.sel-row:hover', fills: ['accent-soft-a03', ...WIZARD], over: 'page', artwork: true, text: ['text-primary', 'text-muted'] },
  { on: '.sel-row.is-selected', fills: ['gold-a10', ...WIZARD], over: 'page', artwork: true, text: ['text-primary', 'text-muted', 'accent-deep'] },
  { on: '.sel-tile', fills: ['elevated-a40', ...WIZARD], over: 'page', artwork: true, text: ['text-primary'] },
  { on: '.sel-tile:hover', fills: ['elevated-a65', ...WIZARD], over: 'page', artwork: true, text: ['text-primary'] },
  { on: '.sel-tile.is-selected', fills: ['gold-a20', ...WIZARD], over: 'page', artwork: true, text: ['text-primary', 'text-muted'] },
  { on: '.skill-chip.mode-add:hover', fills: ['gold-a05', ...WIZARD], over: 'page', artwork: true, text: ['text-primary'] },
]

/** Under AA, reported to the owner and not fixed here. Each floor is the computed value, so any change shows in the diff; the key is `row | text`. */
const KNOWN_LOW: Record<string, number> = {
  '.pop-effect-delta.is-buff, popover | success': 4.129,
  '.pop-effect-delta.is-buff, sheet | success': 4.481,
  '.pop-effect-delta.is-debuff, popover | danger-bright': 4.312,
  '.dice-row.is-crit, .log-row.is-levelup | text-muted': 4.179,
  '.dice-row.is-crit, .log-row.is-levelup | accent-deep': 4.165,
  '.dice-row.is-fail .dice-row-result | danger-bright': 4.331,
  '.log-row.is-hp-damage .log-row-delta | danger-bright': 4.495,
  '.log-row.is-hp-damage .log-row-delta, hovered row | danger-bright': 4.395,
  '.log-row.is-hp-heal .log-row-delta | success': 4.024,
  '.log-row.is-hp-heal .log-row-delta, hovered row | success': 3.958,
  '.status-chip:hover | text-muted': 4.468,
  '.status-chip .sc-mod.is-buff | success': 4.195,
  '.status-chip .sc-mod.is-debuff | danger-bright': 4.404,
  '.inv-item.is-equipped | text-muted': 4.459,
  '.stat-chip .sc-mod.is-buff | success': 4.192,
  '.stat-chip .sc-mod.is-buff, hovered or active chip | success': 3.837,
  '.lu-sum-pill | success': 4.297,
  '.sel-tile.is-selected | text-muted': 4.188,
}

function rgbaOf(name: string): number[] {
  if (name === 'transparent') return [0, 0, 0, 0]
  if (tints[name]) return tints[name]
  if (tokens[name]) return [...hexToRgb(tokens[name]), 1]
  throw new Error(`no token --vtt-${name}`)
}

function lowestContrast(row: TintRow, text: string): number {
  const layers = [...row.fills, ...(row.over === 'page' ? [BODY] : [])].map((fill) => (Array.isArray(fill) ? fill : [fill]))
  const stacks = layers.reduce<string[][]>((all, stops) => all.flatMap((stack) => stops.map((stop) => [...stack, stop])), [[]])
  const base = row.over === 'any' ? [255, 255, 255] : hexToRgb(tokens[row.over === 'page' ? 'bg-base' : row.over])
  const painted = stacks.map((stack) =>
    stack.reduceRight((under, name) => {
      const [r, g, b, a] = rgbaOf(name)
      return [r, g, b].map((v, i) => v * a + under[i] * (1 - a))
    }, base),
  )
  return Math.min(...painted.map((rgb) => contrast(tokens[text], rgbToHex(rgb))))
}

describe('text on a tint', () => {
  const computed = TINT_ROWS.filter((row) => row.over !== 'artwork')
  const cases = computed.flatMap((row) => row.text.map((text) => [`${row.on} | ${text}`, row, text] as const))

  it('names only tokens that exist, the rows on the artwork included', () => {
    for (const row of TINT_ROWS) {
      for (const text of row.text) expect(tokens[text], `--vtt-${text}`).toBeDefined()
      for (const stop of row.fills.flat()) expect(() => rgbaOf(stop)).not.toThrow()
    }
  })

  it.each(cases)('%s meets AA, or holds its known floor', (key, row, text) => {
    expect(lowestContrast(row, text)).toBeGreaterThanOrEqual(KNOWN_LOW[key] ?? 4.5)
  })

  it('keeps a known floor only for a row that is still under AA', () => {
    const lowNow = cases.filter(([, row, text]) => lowestContrast(row, text) < 4.5).map(([key]) => key)
    expect(Object.keys(KNOWN_LOW).sort()).toEqual(lowNow.sort())
  })

  it('holds each known floor at the computed value', () => {
    for (const [key, row, text] of cases) {
      if (key in KNOWN_LOW) expect(Math.floor(lowestContrast(row, text) * 1000) / 1000, key).toBe(KNOWN_LOW[key])
    }
  })

  // Without this the table only reads itself: a site moved onto a weaker tint would pass.
  it('each row names what its rule paints: the top fill is in the background of every selector', () => {
    const rules = [...SOURCES.map(styleBlocks).join('\n').replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap(([, selectors, body]) => {
      const background = [...body.matchAll(/background[\w-]*:[^;]*/g)].join(' ')
      return selectors.replace(/:not\([^)]*\)/g, '').split(',').map((selector) => ({ selector: selector.trim(), background }))
    })
    const missing = TINT_ROWS.filter((row) => row.fills.length).flatMap((row) => {
      const stops = [row.fills[0]].flat().filter((stop) => stop !== 'transparent')
      return row.on
        .split(', ')
        .filter((selector) => selector.startsWith('.'))
        .filter((selector) => {
          const painted = rules.filter((rule) => rule.selector.endsWith(selector)).map((rule) => rule.background).join(' ')
          return !stops.every((stop) => painted.includes(`var(--vtt-${stop})`))
        })
        .map((selector) => `${selector}: ${stops.join(', ')}`)
    })
    expect(missing).toEqual([])
  })
})
