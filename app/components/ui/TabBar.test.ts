import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import TabBar from './TabBar.vue'

let wrapper: VueWrapper | undefined

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

const TABS = [
  { value: 'main', label: 'Main' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'magic', label: 'Magic', disabled: true },
  { value: 'notes', label: 'Notes' },
]

function mountTabs(modelValue = 'main') {
  wrapper = mount(TabBar, {
    props: {
      tabs: TABS,
      modelValue,
      'onUpdate:modelValue': (v: string) => wrapper!.setProps({ modelValue: v }),
    },
    attachTo: document.body,
  })
  return wrapper
}

const tabs = (w: VueWrapper) => w.findAll('[role="tab"]')
const selected = (w: VueWrapper) => w.find('[role="tab"][aria-selected="true"]').text()

describe('TabBar keyboard', () => {
  it('puts only the selected tab in the tab order', () => {
    const w = mountTabs('inventory')
    expect(tabs(w).map((t) => t.attributes('tabindex'))).toEqual(['-1', '0', '-1', '-1'])
  })

  it('selects and focuses the next tab on ArrowRight', async () => {
    const w = mountTabs('main')
    await tabs(w)[0].trigger('keydown', { key: 'ArrowRight' })
    expect(selected(w)).toBe('Inventory')
    expect(document.activeElement?.textContent).toContain('Inventory')
  })

  it('skips disabled tabs', async () => {
    const w = mountTabs('inventory')
    await tabs(w)[1].trigger('keydown', { key: 'ArrowRight' })
    expect(selected(w)).toBe('Notes')
  })

  it('wraps around from the first tab on ArrowLeft', async () => {
    const w = mountTabs('main')
    await tabs(w)[0].trigger('keydown', { key: 'ArrowLeft' })
    expect(selected(w)).toBe('Notes')
  })

  it('jumps to the first and last tab on Home and End', async () => {
    const w = mountTabs('inventory')
    await tabs(w)[1].trigger('keydown', { key: 'End' })
    expect(selected(w)).toBe('Notes')
    await tabs(w)[3].trigger('keydown', { key: 'Home' })
    expect(selected(w)).toBe('Main')
  })
})
