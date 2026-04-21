import DiceBox from '@3d-dice/dice-box'
import type { DieResult } from '@/types/dice'
import { createLogger } from '@/utils/logger'

const log = createLogger('dice-box')

type RollGroup = { sides: number; rolls?: Array<{ value: number }> }

let instance: InstanceType<typeof DiceBox> | null = null
let initPromise: Promise<void> | null = null
let pending: ((results: RollGroup[]) => void) | null = null
let clearTimer: ReturnType<typeof setTimeout> | null = null

const CLEAR_DELAY_MS = 1200
const FADE_MS = 400

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
          if (pending) {
            const resolve = pending
            pending = null
            resolve(results)
          }
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
      reject(new Error('Another roll is already in flight'))
      return
    }
    cancelClear()
    pending = resolve
    try {
      await box.roll(notation as string)
    } catch (err) {
      pending = null
      reject(err)
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
