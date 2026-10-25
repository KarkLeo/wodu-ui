import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { ClientResponseError } from 'pocketbase'
import { pb } from '@/transport/pb'
import { mode } from './mode'
import { createLogger } from '@/utils/logger'

const log = createLogger('transport:connection')

export type ConnectionState = 'ok' | 'checking' | 'down'

export const GRACE_MS = 3000
// The grace period ends with one health check, so a failed write or a network handover that is already
// over does not raise the overlay.
export const GRACE_PROBE_TIMEOUT_MS = 3000
// One deadline for the whole initial load and subscribe, and for each reconnect probe.
export const BOOTSTRAP_TIMEOUT_MS = 6000
const MAX_DELAY_MS = 15000

export const connection: Ref<ConnectionState> = ref('ok')
export const attempt: Ref<number> = ref(0)

const probingFlag = ref(false)
// Read-only for the UI: Retry is unavailable while a probe is in flight, since retryNow() would be a no-op.
export const probing: ComputedRef<boolean> = computed(() => probingFlag.value)

export function isNetworkError(err: unknown): boolean {
  if (err instanceof ClientResponseError) return err.status === 0 && !err.isAbort
  if (err instanceof TypeError) return /fetch|network|load failed/i.test(err.message)
  return err instanceof Error && err.message === 'timeout'
}

export function reconnectDelay(n: number): number {
  return Math.min(1000 * 2 ** n, MAX_DELAY_MS)
}

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    p.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) },
    )
  })
}

let graceTimer: ReturnType<typeof setTimeout> | null = null
let graceExpired = false
let graceProbeActive = false
// Bumped whenever a grace period starts or ends, so a health check from an earlier one is ignored.
let graceGen = 0
let loopTimer: ReturnType<typeof setTimeout> | null = null
let looping = false
let generation = 0
let reconnectHandler: (() => Promise<void>) | null = null

export type ProblemOutcome = 'ok' | 'down'
let outcomeWaiters: ((outcome: ProblemOutcome) => void)[] = []

function setConnection(next: ConnectionState) {
  connection.value = next
  if (next === 'checking' || outcomeWaiters.length === 0) return
  const waiters = outcomeWaiters
  outcomeWaiters = []
  for (const resolve of waiters) resolve(next)
}

/**
 * How the current network problem ends: 'down' once the overlay is up, 'ok' when the server turned out
 * to be reachable (or the monitor was stopped). Resolves at once when no grace period is running.
 */
export function problemOutcome(): Promise<ProblemOutcome> {
  if (connection.value !== 'checking') return Promise.resolve(connection.value)
  return new Promise(resolve => { outcomeWaiters.push(resolve) })
}

function clearGrace() {
  if (graceTimer) clearTimeout(graceTimer)
  graceTimer = null
  graceExpired = false
  graceProbeActive = false
  graceGen += 1
}

function clearLoopTimer() {
  if (loopTimer) clearTimeout(loopTimer)
  loopTimer = null
}

function cancelLoop() {
  generation += 1
  looping = false
  probingFlag.value = false
  clearLoopTimer()
}

function scheduleProbe(gen: number) {
  clearLoopTimer()
  if (gen !== generation) return
  loopTimer = setTimeout(() => { void probe(gen) }, reconnectDelay(attempt.value))
}

async function probe(gen: number) {
  if (probingFlag.value || gen !== generation) return
  probingFlag.value = true
  clearLoopTimer()
  attempt.value += 1
  try {
    await withTimeout(pb.health.check(), BOOTSTRAP_TIMEOUT_MS)
    if (gen !== generation) return
    if (reconnectHandler) await reconnectHandler()
    if (gen !== generation) return
    looping = false
    attempt.value = 0
    setConnection('ok')
  } catch (err) {
    log.debug('reconnect probe failed', { err })
    if (gen === generation) scheduleProbe(gen)
  } finally {
    if (gen === generation) probingFlag.value = false
  }
}

function startLoop() {
  if (looping) return
  looping = true
  attempt.value = 0
  scheduleProbe(generation)
}

function goDown() {
  clearGrace()
  setConnection('down')
  startLoop()
}

// A failed check before the grace period is over (an early probe on the browser's `online` event)
// decides nothing; the one that ends after it does.
async function graceProbe(gen: number) {
  graceProbeActive = true
  let reachable = false
  try {
    await withTimeout(pb.health.check(), GRACE_PROBE_TIMEOUT_MS)
    reachable = true
  } catch (err) {
    log.debug('grace health check failed', { err })
  }
  if (gen !== graceGen) return
  graceProbeActive = false
  if (connection.value !== 'checking' || mode.value !== 'online') return
  if (reachable) markReachable()
  else if (graceExpired) goDown()
}

export function reportNetworkProblem(opts?: { immediate?: boolean }): void {
  // An online request that fails after a switch to offline must not start probing PocketBase.
  if (mode.value === 'offline' || connection.value === 'down') return
  if (opts?.immediate) {
    goDown()
    return
  }
  if (connection.value === 'checking') return
  clearGrace()
  const gen = graceGen
  setConnection('checking')
  graceTimer = setTimeout(() => {
    graceTimer = null
    graceExpired = true
    if (!graceProbeActive) void graceProbe(gen)
  }, GRACE_MS)
}

export function markReachable(): void {
  clearGrace()
  if (connection.value === 'down' || connection.value === 'checking') {
    cancelLoop()
    setConnection('ok')
    attempt.value = 0
  }
}

export function retryNow(): void {
  if (connection.value !== 'down') return
  looping = true
  void probe(generation)
}

/** Checks the server now instead of waiting for the next timer, e.g. when the browser is back online. */
export function probeNow(): void {
  if (mode.value !== 'online') return
  if (connection.value === 'down') retryNow()
  else if (connection.value === 'checking' && !graceProbeActive) void graceProbe(graceGen)
}

export function onReconnect(fn: () => Promise<void>): void {
  reconnectHandler = fn
}

export function stopConnectionMonitor(): void {
  clearGrace()
  cancelLoop()
  setConnection('ok')
  attempt.value = 0
}
