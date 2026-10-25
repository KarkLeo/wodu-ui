import { describe, expect, it } from 'vitest'
import { ClientResponseError } from 'pocketbase'
import { isNetworkError, reconnectDelay, withTimeout } from './connection'

describe('isNetworkError', () => {
  it('classifies errors', () => {
    expect(isNetworkError(new ClientResponseError({ status: 0 }))).toBe(true)
    expect(isNetworkError(new ClientResponseError({ status: 0, isAbort: true }))).toBe(false)
    expect(isNetworkError(new ClientResponseError({ status: 400 }))).toBe(false)
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isNetworkError(new Error('timeout'))).toBe(true)
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
