import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import NotesPanel from './NotesPanel.vue'
import { makeCharacter } from '@/test/fixtures'

afterEach(() => {
  vi.useRealTimers()
})

describe('NotesPanel', () => {
  it('saves typed notes after a pause, without waiting for blur', async () => {
    vi.useFakeTimers()
    const dispatch = vi.fn()
    const w = mount(NotesPanel, { props: { char: makeCharacter(), dispatch } })

    await w.find('textarea').setValue('Owes the miller 3 silver')
    expect(dispatch).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)

    expect(dispatch).toHaveBeenCalledWith({ type: 'UPDATE_NOTES', notes: 'Owes the miller 3 silver' })
    w.unmount()
  })

  it('saves pending text when the panel goes away mid-typing', async () => {
    vi.useFakeTimers()
    const dispatch = vi.fn()
    const w = mount(NotesPanel, { props: { char: makeCharacter(), dispatch } })

    await w.find('textarea').setValue('Map to the old mine')
    w.unmount()

    expect(dispatch).toHaveBeenCalledWith({ type: 'UPDATE_NOTES', notes: 'Map to the old mine' })
  })
})
