import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HpControlsPanel from './HpControlsPanel.vue'
import XpControlsPanel from './XpControlsPanel.vue'

let wrapper: VueWrapper | undefined

beforeEach(() => setActivePinia(createPinia()))
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('HpControlsPanel', () => {
  function mountPanel() {
    wrapper = mount(HpControlsPanel, { props: { current: 9, max: 12 }, attachTo: document.body })
    return wrapper
  }

  it('exposes the damage/heal/temporary switch as a radio group', () => {
    const w = mountPanel()
    expect(w.find('[role="radiogroup"]').attributes('aria-label')).toBeTruthy()
    expect(w.findAll('[role="radio"]').map((r) => r.attributes('aria-checked'))).toEqual(['true', 'false', 'false'])
  })

  it('moves the switch with arrow keys', async () => {
    const w = mountPanel()
    await w.findAll('[role="radio"]')[0].trigger('keydown', { key: 'ArrowRight' })
    expect(w.find('[role="radio"][aria-checked="true"]').text()).toBe('Heal')
  })

  it('names the amount field and its step buttons', () => {
    const w = mountPanel()
    expect(w.find('.hp-amount input').attributes('aria-label')).toBeTruthy()
    expect(w.findAll('.hp-amount button').map((b) => b.attributes('aria-label'))).toEqual(['Decrease', 'Increase'])
  })
})

describe('XpControlsPanel', () => {
  it('labels the manual input with its visible label', () => {
    wrapper = mount(XpControlsPanel, { props: { current: 100, max: 3000 }, attachTo: document.body })
    const input = wrapper.find('.xp-pop-manual input')
    const labelId = input.attributes('aria-labelledby')
    expect(labelId).toBeTruthy()
    expect(document.getElementById(labelId!)?.textContent).toBe('Input')
  })
})
