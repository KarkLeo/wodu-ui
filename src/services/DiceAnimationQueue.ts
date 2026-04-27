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
let workerRunning = false

function refreshAnimating() {
  _isAnimating.value = queue.length > 0 || workerRunning
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

function buildNotation(dice: DieResult[], notation: string): string {
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
  const allValues = dice.map(d => d.value).join(',')
  if (order.length === 1) {
    const sides = order[0]
    return `${dice.length}d${sides}@${allValues}`
  }
  const terms = order.map(sides => {
    const values = groupedBySides.get(sides)!
    return `${values.length}d${sides}@${values.join(',')}`
  })
  return terms.join('+')
}

async function processNext() {
  if (workerRunning) return
  workerRunning = true
  refreshAnimating()
  while (queue.length > 0) {
    const job = queue.shift()!
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

export function clear(): void {
  while (queue.length > 0) {
    const job = queue.shift()!
    job.reject(new Error('Cleared'))
  }
  try { instance?.clearDice() } catch { /* noop */ }
  refreshAnimating()
}
