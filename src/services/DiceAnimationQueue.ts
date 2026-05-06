import { ref, readonly } from 'vue'
import DiceBox from '@3d-dice/dice-box-threejs'
import type { DieResult } from '@/types/dice'
import { createLogger } from '@/utils/logger'

const log = createLogger('dice-box')

const CLEAR_DELAY_MS = 1200
const FADE_MS = 400
const ROLL_WATCHDOG_MS = 10000
const OVERLAY_SELECTOR = '#dice-overlay'

let instance: DiceBox | null = null
let initPromise: Promise<DiceBox> | null = null
let clearTimer: ReturnType<typeof setTimeout> | null = null

const _isAnimating = ref(false)
export const isAnimating = readonly(_isAnimating)

const queue: Array<{ dice: DieResult[]; notation: string; resolve: () => void; reject: (e: Error) => void }> = []
let coalescedSlot: { dice: DieResult[]; notation: string } | null = null
let workerRunning = false

function refreshAnimating() {
  _isAnimating.value = queue.length > 0 || workerRunning || coalescedSlot !== null
}

function scheduleClear() {
  if (clearTimer) clearTimeout(clearTimer)
  const overlay = document.querySelector(OVERLAY_SELECTOR)
  clearTimer = setTimeout(() => {
    overlay?.classList.add('dice-overlay--fading')
    setTimeout(() => {
      try { instance?.clearDice() } catch { /* noop */ }
      overlay?.classList.remove('dice-overlay--fading')
    }, FADE_MS)
  }, CLEAR_DELAY_MS)
}

function cancelClear() {
  if (clearTimer) {
    clearTimeout(clearTimer)
    clearTimer = null
  }
  document.querySelector(OVERLAY_SELECTOR)?.classList.remove('dice-overlay--fading')
}

export async function getDiceBox(): Promise<DiceBox> {
  if (instance) return instance
  if (!initPromise) {
    log.info('init: starting')
    initPromise = (async () => {
      const box = new DiceBox(OVERLAY_SELECTOR, {
        assetPath: '/dice-assets/',
        sounds: false,
        shadows: true,
        theme_surface: 'green-felt',
        theme_colorset: 'white',
        theme_material: 'glass',
        theme_texture: '',
        gravity_multiplier: 400,
        light_intensity: 0.7,
        strength: 1,
      })
      try {
        await box.initialize()
        instance = box
        log.info('init: done')
        return box
      } catch (err) {
        log.error('init: failed', err)
        initPromise = null
        throw err
      }
    })()
  }
  return initPromise
}

function expandPercentile(dice: DieResult[]): Array<{ sides: number; value: number }> {
  const out: Array<{ sides: number; value: number }> = []
  for (const d of dice) {
    if (d.sides === 100) {
      const v = Math.max(1, Math.min(100, d.value))
      const tensDigit = Math.floor(v / 10) % 10
      const onesDigit = v % 10
      const tensValue = tensDigit === 0 ? 100 : tensDigit * 10
      const onesValue = onesDigit === 0 ? 10 : onesDigit
      out.push({ sides: 100, value: tensValue })
      out.push({ sides: 10, value: onesValue })
    } else {
      out.push({ sides: d.sides, value: d.value })
    }
  }
  return out
}

function buildNotation(rawDice: DieResult[], notation: string): string {
  const dice = expandPercentile(rawDice)
  if (dice.length === 0) return notation
  const groupedBySides = new Map<number, number[]>()
  const order: number[] = []
  for (const d of dice) {
    if (!groupedBySides.has(d.sides)) {
      groupedBySides.set(d.sides, [])
      order.push(d.sides)
    }
    groupedBySides.get(d.sides)!.push(d.value)
  }
  const terms = order.map(sides => `${groupedBySides.get(sides)!.length}d${sides}`)
  const allValues = order.flatMap(sides => groupedBySides.get(sides)!)
  return `${terms.join('+')}@${allValues.join(',')}`
}

async function processNext() {
  if (workerRunning) return
  workerRunning = true
  refreshAnimating()
  while (queue.length > 0 || coalescedSlot !== null) {
    let job: { dice: DieResult[]; notation: string; resolve: () => void; reject: (e: Error) => void }
    if (queue.length > 0) {
      job = queue.shift()!
    } else {
      const slot = coalescedSlot!
      coalescedSlot = null
      job = { dice: slot.dice, notation: slot.notation, resolve: () => {}, reject: () => {} }
    }
    refreshAnimating()
    const notationWithValues = buildNotation(job.dice, job.notation)
    log.debug('rolling', { notation: notationWithValues })
    let watchdog: ReturnType<typeof setTimeout> | undefined
    try {
      const box = await getDiceBox()
      cancelClear()
      await new Promise<void>((resolve, reject) => {
        watchdog = setTimeout(() => {
          log.error('watchdog fired', { notation: notationWithValues })
          reject(new Error(`Dice animation timed out after ${ROLL_WATCHDOG_MS}ms`))
        }, ROLL_WATCHDOG_MS)
        box.roll(notationWithValues)
          .then(() => resolve())
          .catch(err => reject(err instanceof Error ? err : new Error(String(err))))
      })
      scheduleClear()
      job.resolve()
    } catch (err) {
      log.error('animation job failed', err)
      try { instance?.clearDice() } catch { /* noop */ }
      job.reject(err instanceof Error ? err : new Error(String(err)))
    } finally {
      if (watchdog) clearTimeout(watchdog)
    }
  }
  workerRunning = false
  refreshAnimating()
}

export function enqueue(dice: DieResult[], notation: string): Promise<void> {
  log.debug('enqueue', { notation, diceCount: dice.length })
  if (dice.length === 0) {
    log.warn('enqueue: no dice, skipping animation', { notation })
    return Promise.resolve()
  }
  return new Promise<void>((resolve, reject) => {
    queue.push({ dice, notation, resolve, reject })
    refreshAnimating()
    void processNext()
  })
}

export function enqueueCoalesced(dice: DieResult[], notation: string): void {
  if (dice.length === 0) return
  if (queue.length === 0 && !workerRunning && coalescedSlot === null) {
    void enqueue(dice, notation)
    return
  }
  log.debug('enqueueCoalesced: replacing pending slot', { notation, diceCount: dice.length })
  coalescedSlot = { dice, notation }
  refreshAnimating()
  void processNext()
}

export function clear(): void {
  while (queue.length > 0) {
    const job = queue.shift()!
    job.reject(new Error('Cleared'))
  }
  coalescedSlot = null
  try { instance?.clearDice() } catch { /* noop */ }
  refreshAnimating()
}
