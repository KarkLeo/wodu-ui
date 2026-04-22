import DiceBox from '@3d-dice/dice-box'
import type { DieResult } from '@/types/dice'
import { createLogger } from '@/utils/logger'

const log = createLogger('dice-box')

type RollGroup = { sides: number; rolls?: Array<{ value: number }> }

let instance: InstanceType<typeof DiceBox> | null = null
let initPromise: Promise<void> | null = null
let pending: {
  resolve: (results: RollGroup[]) => void
  reject: (err: Error) => void
  watchdog: ReturnType<typeof setTimeout>
} | null = null
let clearTimer: ReturnType<typeof setTimeout> | null = null

const CLEAR_DELAY_MS = 1200
const FADE_MS = 400
const ROLL_WATCHDOG_MS = 10000

function resolvePending(results: RollGroup[]) {
  if (!pending) return
  const { resolve, watchdog } = pending
  clearTimeout(watchdog)
  pending = null
  resolve(results)
}

function rejectPending(reason: string) {
  if (!pending) return
  const { reject, watchdog } = pending
  clearTimeout(watchdog)
  pending = null
  try { instance?.clear() } catch {}
  reject(new Error(reason))
}

function scheduleClear() {
  if (clearTimer) clearTimeout(clearTimer)
  const overlay = document.getElementById('dice-overlay')
  clearTimer = setTimeout(() => {
    overlay?.classList.add('dice-overlay--fading')
    setTimeout(() => {
      instance?.clear()
      overlay?.classList.remove('dice-overlay--fading')
    }, FADE_MS)
  }, CLEAR_DELAY_MS)
}

function cancelClear() {
  if (clearTimer) {
    clearTimeout(clearTimer)
    clearTimer = null
  }
  document.getElementById('dice-overlay')?.classList.remove('dice-overlay--fading')
}

export async function getDiceBox(): Promise<InstanceType<typeof DiceBox>> {
  if (instance) return instance

  if (!initPromise) {
    log.info('init: starting')
    initPromise = (async () => {
      const box = new DiceBox({
        container: '#dice-overlay',
        assetPath: '/assets/',
        gravity: 2,
        mass: 1,
        friction: 0.8,
        restitution: 0,
        angularDamping: 0.4,
        linearDamping: 0.4,
        spinForce: 6,
        throwForce: 6,
        startingHeight: 10,
        theme: 'default',
        themeColor: '#d4a853',
        onRollComplete: (results: RollGroup[]) => {
          log.debug('onRollComplete', { groups: results.length })
          resolvePending(results)
          scheduleClear()
        },
      })
      try {
        await box.init()
        instance = box
        log.info('init: done')
      } catch (err) {
        log.error('init: failed', err)
        initPromise = null
        throw err
      }
    })()
  }

  await initPromise
  return instance!
}

function rollViaCallback(notation: string | string[]): Promise<RollGroup[]> {
  return new Promise(async (resolve, reject) => {
    const box = await getDiceBox()
    if (pending) {
      log.warn('rollViaCallback: resetting stuck pending roll')
      rejectPending('Previous roll never completed — reset')
    }
    cancelClear()
    const watchdog = setTimeout(() => {
      log.error('rollViaCallback: watchdog fired', { notation })
      rejectPending(`Dice roll timed out after ${ROLL_WATCHDOG_MS}ms`)
    }, ROLL_WATCHDOG_MS)
    pending = { resolve, reject, watchdog }
    try {
      await box.roll(notation as string)
    } catch (err) {
      log.error('rollViaCallback: box.roll threw', err)
      rejectPending(err instanceof Error ? err.message : String(err))
    }
  })
}

export async function rollNotation(notation: string): Promise<DieResult[]> {
  log.debug('rollNotation', { notation })
  const results = await rollViaCallback(notation)
  const dice = results.flatMap(group =>
    (group.rolls ?? []).map(r => ({
      sides: group.sides as DieResult['sides'],
      value: r.value,
    }))
  )
  if (dice.length === 0) {
    log.error('rollNotation: empty', { notation })
    throw new Error(`Dice roll returned no results for notation "${notation}"`)
  }
  log.debug('rollNotation: done', { notation, values: dice.map(d => d.value) })
  return dice
}

export async function rollGroups(notations: string[]): Promise<DieResult[][]> {
  log.debug('rollGroups', { notations })
  const results = await rollViaCallback(notations)
  const groups = results.map(group =>
    (group.rolls ?? []).map(r => ({
      sides: group.sides as DieResult['sides'],
      value: r.value,
    }))
  )
  log.debug('rollGroups: done', { groups: groups.map(g => g.map(d => d.value)) })
  return groups
}
