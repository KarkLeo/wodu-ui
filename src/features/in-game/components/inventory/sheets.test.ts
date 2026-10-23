import { describe, it, expect, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import CatalogSheet from './CatalogSheet.vue'
import CustomItemSheet from './CustomItemSheet.vue'

let wrapper: VueWrapper | undefined

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

function dialogName(): string | null {
  const dialog = document.querySelector('[role="dialog"]')
  const id = dialog?.getAttribute('aria-labelledby')
  return id ? document.getElementById(id)?.textContent?.trim() ?? null : null
}

describe('inventory sheets', () => {
  it('names the catalog dialog with its title', async () => {
    wrapper = mount(CatalogSheet, { props: { open: true, coins: 30 }, attachTo: document.body })
    await flushPromises()
    expect(dialogName()).toBe('Gear catalog')
  })

  it('names the custom item dialog with its title', async () => {
    wrapper = mount(CustomItemSheet, { props: { open: true, editing: null }, attachTo: document.body })
    await flushPromises()
    expect(dialogName()).toBe('Custom item')
  })
})
