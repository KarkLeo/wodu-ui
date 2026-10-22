import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import SegmentedFilter from './SegmentedFilter.vue'

let wrapper: VueWrapper | undefined

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

const OPTIONS = [
  { value: 'rolls', label: 'Rolls' },
  { value: 'changes', label: 'Changes' },
  { value: 'all', label: 'All' },
]

function mountFilter(modelValue = 'rolls') {
  wrapper = mount(SegmentedFilter, {
    props: {
      options: OPTIONS,
      modelValue,
      'onUpdate:modelValue': (v: string) => wrapper!.setProps({ modelValue: v }),
    },
    attachTo: document.body,
  })
  return wrapper
}

describe('SegmentedFilter', () => {
  it('is a radio group with the checked option marked', () => {
    const w = mountFilter('changes')
    expect(w.find('[role="radiogroup"]').exists()).toBe(true)
    expect(w.findAll('[role="radio"]').map((r) => r.attributes('aria-checked'))).toEqual(['false', 'true', 'false'])
  })

  it('puts only the checked option in the tab order', () => {
    const w = mountFilter('changes')
    expect(w.findAll('[role="radio"]').map((r) => r.attributes('tabindex'))).toEqual(['-1', '0', '-1'])
  })

  it('moves the selection with arrow keys', async () => {
    const w = mountFilter('rolls')
    await w.findAll('[role="radio"]')[0].trigger('keydown', { key: 'ArrowRight' })
    expect(w.find('[aria-checked="true"]').text()).toBe('Changes')
    expect(document.activeElement?.textContent?.trim()).toBe('Changes')
  })
})
