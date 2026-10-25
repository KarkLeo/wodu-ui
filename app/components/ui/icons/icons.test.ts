import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Component } from 'vue'

const icons = import.meta.glob<{ default: Component }>('./Icon*.vue', { eager: true })

describe.each(Object.entries(icons))('%s', (_, mod) => {
  it('is hidden from assistive technology', () => {
    const svg = mount(mod.default).find('svg')
    expect(svg.attributes('aria-hidden')).toBe('true')
  })

  it('takes its rendered size from the size prop', () => {
    const svg = mount(mod.default, { props: { size: 20 } }).find('svg')
    expect(svg.attributes('width')).toBe('20')
    expect(svg.attributes('height')).toBe('20')
  })

  const stroked = mount(mod.default).find('svg').attributes('stroke') === 'currentColor'

  it.runIf(stroked)('takes its stroke width from the strokeWidth prop', () => {
    const svg = mount(mod.default, { props: { strokeWidth: 2.5 } }).find('svg')
    expect(svg.html()).toContain('stroke-width="2.5"')
  })
})
