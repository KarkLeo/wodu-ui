import { describe, it, expect, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import XpBar from './XpBar.vue'
import XpControlsPanel from './XpControlsPanel.vue'

let wrapper: VueWrapper | undefined

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

async function openControls(props: { current: number }) {
  wrapper = mount(XpBar, { props: { max: 3000, ...props }, attachTo: document.body })
  await wrapper.find('.xp-bar-values').trigger('click')
  await flushPromises()
  return wrapper
}

describe('XpBar', () => {
  it('forwards a step from the controls panel as update:current', async () => {
    const w = await openControls({ current: 1840 })
    w.findComponent(XpControlsPanel).vm.$emit('update:current', 1850)
    expect(w.emitted('update:current')).toEqual([[1850]])
  })

  it('clamps negative values to zero', async () => {
    const w = await openControls({ current: 40 })
    w.findComponent(XpControlsPanel).vm.$emit('update:current', -60)
    expect(w.emitted('update:current')).toEqual([[0]])
  })

  it('keeps showing the current prop until the parent updates it', async () => {
    const w = await openControls({ current: 40 })
    w.findComponent(XpControlsPanel).vm.$emit('update:current', 50)
    await flushPromises()
    expect(w.find('.xp-current').text()).toBe('40')
  })
})
