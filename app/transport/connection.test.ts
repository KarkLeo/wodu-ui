import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClientResponseError } from 'pocketbase'

const health = vi.hoisted(() => ({ check: vi.fn<() => Promise<unknown>>() }))
vi.mock('@/transport/pb', () => ({ pb: { health } }))

import {
  connection,
  GRACE_MS,
  GRACE_PROBE_TIMEOUT_MS,
  isNetworkError,
  probeNow,
  problemOutcome,
  reconnectDelay,
  reportNetworkProblem,
  stopConnectionMonitor,
  withTimeout,
} from './connection'

describe('isNetworkError', () => {
  it('classifies errors', () => {
    expect(isNetworkError(new ClientResponseError({ status: 0 }))).toBe(true)
    expect(isNetworkError(new ClientResponseError({ status: 0, isAbort: true }))).toBe(false)
    expect(isNetworkError(new ClientResponseError({ status: 400 }))).toBe(false)
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isNetworkError(new Error('timeout'))).toBe(true)
    expect(isNetworkError(new TypeError('x is not a function'))).toBe(false)
  })
})

describe('reconnectDelay', () => {
  it('backs off to the cap', () => {
    expect([0, 1, 2, 3, 4, 10].map(reconnectDelay)).toEqual([1000, 2000, 4000, 8000, 15000, 15000])
  })
})

describe('withTimeout', () => {
  it('rejects when the promise hangs', async () => {
    await expect(withTimeout(new Promise(() => {}), 10)).rejects.toThrow('timeout')
  })
  it('passes through the result', async () => {
    await expect(withTimeout(Promise.resolve(1), 10)).resolves.toBe(1)
  })
})

function deferred() {
  let resolve!: (v: unknown) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<unknown>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('grace period', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    health.check.mockReset()
    stopConnectionMonitor()
  })
  afterEach(() => {
    stopConnectionMonitor()
    vi.useRealTimers()
  })

  it('ends in ok without an overlay when the server answers the health check', async () => {
    health.check.mockResolvedValue({ code: 200 })
    reportNetworkProblem()
    expect(connection.value).toBe('checking')
    const result = problemOutcome()
    await vi.advanceTimersByTimeAsync(GRACE_MS - 1)
    expect(health.check).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(health.check).toHaveBeenCalledTimes(1)
    expect(connection.value).toBe('ok')
    await expect(result).resolves.toBe('ok')
  })

  it('goes down when the health check fails', async () => {
    health.check.mockRejectedValue(new TypeError('Failed to fetch'))
    reportNetworkProblem()
    const result = problemOutcome()
    await vi.advanceTimersByTimeAsync(GRACE_MS)
    expect(connection.value).toBe('down')
    await expect(result).resolves.toBe('down')
  })

  it('goes down when the health check hangs past its timeout', async () => {
    health.check.mockReturnValue(new Promise(() => {}))
    reportNetworkProblem()
    await vi.advanceTimersByTimeAsync(GRACE_MS + GRACE_PROBE_TIMEOUT_MS - 1)
    expect(connection.value).toBe('checking')
    await vi.advanceTimersByTimeAsync(1)
    expect(connection.value).toBe('down')
  })

  it('ignores a grace probe that finishes after the monitor stopped', async () => {
    const pending = deferred()
    health.check.mockReturnValue(pending.promise)
    reportNetworkProblem()
    await vi.advanceTimersByTimeAsync(GRACE_MS)
    expect(health.check).toHaveBeenCalledTimes(1)
    stopConnectionMonitor()
    expect(connection.value).toBe('ok')
    pending.reject(new TypeError('Failed to fetch'))
    await vi.advanceTimersByTimeAsync(GRACE_PROBE_TIMEOUT_MS)
    expect(connection.value).toBe('ok')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not let a stale grace probe decide a later problem', async () => {
    const stale = deferred()
    health.check.mockReturnValueOnce(stale.promise)
    reportNetworkProblem()
    await vi.advanceTimersByTimeAsync(GRACE_MS)
    stopConnectionMonitor()
    health.check.mockResolvedValue({ code: 200 })
    reportNetworkProblem()
    stale.reject(new TypeError('Failed to fetch'))
    await vi.advanceTimersByTimeAsync(0)
    expect(connection.value).toBe('checking')
    await vi.advanceTimersByTimeAsync(GRACE_MS)
    expect(connection.value).toBe('ok')
  })

  it('probeNow() during the grace period recovers early when the server answers', async () => {
    health.check.mockResolvedValue({ code: 200 })
    reportNetworkProblem()
    probeNow()
    await vi.advanceTimersByTimeAsync(0)
    expect(connection.value).toBe('ok')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('probeNow() that fails before the grace period ends leaves the decision to the grace check', async () => {
    health.check.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    reportNetworkProblem()
    probeNow()
    await vi.advanceTimersByTimeAsync(0)
    expect(connection.value).toBe('checking')
    health.check.mockResolvedValue({ code: 200 })
    await vi.advanceTimersByTimeAsync(GRACE_MS)
    expect(connection.value).toBe('ok')
  })

  it('problemOutcome() resolves at once when nothing is pending', async () => {
    await expect(problemOutcome()).resolves.toBe('ok')
  })

  it('problemOutcome() resolves ok when the monitor is stopped mid-check', async () => {
    reportNetworkProblem()
    const result = problemOutcome()
    stopConnectionMonitor()
    await expect(result).resolves.toBe('ok')
  })
})
