import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import HpBar from './HpBar.vue'

let wrapper: VueWrapper | undefined

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('HpBar', () => {
  it('has three tab stops: values, decrease and heal', () => {
    wrapper = mount(HpBar, { props: { current: 6, max: 12 }, attachTo: document.body })
    const stops = wrapper.findAll('button, [tabindex="0"]').map((el) => el.classes())
    expect(stops).toHaveLength(3)
    expect(stops[0]).toContain('hp-bar-values')
    expect(wrapper.find('.hp-bar-track-wrap').attributes('tabindex')).toBeUndefined()
  })

  it('includes the visible value in the edit button name', () => {
    wrapper = mount(HpBar, { props: { current: 6, max: 12, temp: 4 }, attachTo: document.body })
    const values = wrapper.find('.hp-bar-values')
    const visible = values.text().replace(/\s+/g, '')
    expect(visible).toBe('6/12+4')
    expect(values.attributes('aria-label')).toContain(visible)
  })
})
