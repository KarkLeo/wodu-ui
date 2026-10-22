import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import StatChip from './StatChip.vue'

let wrapper: VueWrapper | undefined

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

function mountChip(props: Record<string, unknown>) {
  wrapper = mount(StatChip, {
    props: { label: 'STR', value: 1, editable: true, ...props },
    attachTo: document.body,
  })
  return wrapper
}

describe('StatChip', () => {
  it('emits toggleEdit when an editable chip is clicked', async () => {
    const w = mountChip({ editing: false })
    await w.find('.stat-chip').trigger('click')
    expect(w.emitted('toggleEdit')).toHaveLength(1)
  })

  describe('editing', () => {
    it('does not nest the stepper inside a button', () => {
      const w = mountChip({ editing: true })
      expect(w.find('.stat-chip').element.tagName).not.toBe('BUTTON')
    })

    it('changes the value on stepper click without leaving edit mode', async () => {
      const w = mountChip({ editing: true })
      await w.find('.sc-stepper button:last-of-type').trigger('click')
      expect(w.emitted('update:value')?.[0]).toEqual([2])
      expect(w.emitted('toggleEdit')).toBeUndefined()
    })

    it('leaves edit mode on Enter', async () => {
      const w = mountChip({ editing: true })
      await w.find('.stat-chip').trigger('keydown', { key: 'Enter' })
      expect(w.emitted('toggleEdit')).toHaveLength(1)
    })

    it('leaves edit mode on a pointer press outside the chip', async () => {
      const w = mountChip({ editing: true })
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
      await w.vm.$nextTick()
      expect(w.emitted('toggleEdit')).toHaveLength(1)
    })

    it('stays in edit mode on a pointer press inside the chip', async () => {
      const w = mountChip({ editing: true })
      w.find('.sc-label').element.dispatchEvent(new Event('pointerdown', { bubbles: true }))
      await w.vm.$nextTick()
      expect(w.emitted('toggleEdit')).toBeUndefined()
    })
  })
})
