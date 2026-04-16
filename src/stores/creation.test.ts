import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCreationStore } from './creation'

beforeEach(() => { setActivePinia(createPinia()) })

describe('useCreationStore', () => {
  it('starts at step 1 with no draft', () => {
    const store = useCreationStore()
    expect(store.step).toBe(1)
    expect(store.draftId).toBeNull()
  })

  it('setDraft() sets the draft id', () => {
    const store = useCreationStore()
    store.setDraft('abc-123')
    expect(store.draftId).toBe('abc-123')
  })

  it('nextStep() increments up to 4', () => {
    const store = useCreationStore()
    store.nextStep()
    expect(store.step).toBe(2)
    store.nextStep(); store.nextStep(); store.nextStep()
    expect(store.step).toBe(4) // не больше 4
  })

  it('reset() clears draft and step', () => {
    const store = useCreationStore()
    store.setDraft('abc')
    store.nextStep()
    store.reset()
    expect(store.draftId).toBeNull()
    expect(store.step).toBe(1)
  })
})
