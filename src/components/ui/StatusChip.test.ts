import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatusChip from './StatusChip.vue'

describe('StatusChip', () => {
  it('renders the #value slot without a popover', () => {
    const w = mount(StatusChip, {
      props: { kind: 'damage', label: 'DMG', value: 'd6' },
      slots: { value: '<b class="custom">d6+1</b>' },
    })
    expect(w.find('.sc-value .custom').text()).toBe('d6+1')
  })

  it('falls back to the value prop when no slot is given', () => {
    const w = mount(StatusChip, { props: { kind: 'armor', label: 'ARM', value: 2 } })
    expect(w.find('.sc-value').text()).toBe('2')
  })
})
