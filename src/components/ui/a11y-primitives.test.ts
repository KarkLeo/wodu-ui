import { describe, it, expect, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import SkillChip from './SkillChip.vue'
import AbilityCard from './AbilityCard.vue'
import Stepper from './Stepper.vue'
import FormCheckbox from './FormCheckbox.vue'
import ConfirmSheet from './ConfirmSheet.vue'
import BottomSheet from './BottomSheet.vue'

let wrapper: VueWrapper | undefined

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('SkillChip', () => {
  it('renders a read-only chip in display mode, not a button', () => {
    wrapper = mount(SkillChip, { props: { label: 'Athletics', mode: 'display' } })
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.text()).toBe('Athletics')
  })

  it('stays a checkbox button in pick mode', () => {
    wrapper = mount(SkillChip, { props: { label: 'Athletics', mode: 'pick-multi', state: 'selected' } })
    const chip = wrapper.find('button')
    expect(chip.attributes('role')).toBe('checkbox')
    expect(chip.attributes('aria-checked')).toBe('true')
  })
})

describe('AbilityCard', () => {
  it('marks a locked pick card as disabled for assistive technology', () => {
    wrapper = mount(AbilityCard, { props: { title: 'Cure', mode: 'pick-multi', state: 'locked' } })
    expect(wrapper.find('[role="checkbox"]').attributes('aria-disabled')).toBe('true')
  })
})

describe('Stepper', () => {
  it('groups its controls under the given label and names the field', () => {
    wrapper = mount(Stepper, { props: { modelValue: 1, ariaLabel: 'Edit STR' } })
    const group = wrapper.find('.sc-stepper')
    expect(group.attributes('role')).toBe('group')
    expect(group.attributes('aria-label')).toBe('Edit STR')
    expect(wrapper.find('input').attributes('aria-label')).toBeTruthy()
  })
})

describe('FormCheckbox', () => {
  it('accepts an accessible name when there is no visible label', () => {
    wrapper = mount(FormCheckbox, { props: { modelValue: false, ariaLabel: 'Equipped' } })
    expect(wrapper.find('input').attributes('aria-label')).toBe('Equipped')
  })

  it('can be disabled', async () => {
    wrapper = mount(FormCheckbox, { props: { modelValue: false, disabled: true }, slots: { default: 'Equipped' } })
    expect(wrapper.find('input').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.form-check').classes()).toContain('is-disabled')
  })
})

describe('ConfirmSheet', () => {
  it('names the dialog with its title', async () => {
    wrapper = mount(ConfirmSheet, {
      props: { open: true, title: 'Quicksilver overdose' },
      slots: { default: 'Already 3 doses today.' },
      attachTo: document.body,
    })
    await flushPromises()
    const dialog = document.querySelector('[role="dialog"]')!
    const title = document.getElementById(dialog.getAttribute('aria-labelledby') ?? '')
    expect(title?.textContent).toBe('Quicksilver overdose')
  })
})

describe('BottomSheet', () => {
  it('offers a close button even without a title', async () => {
    wrapper = mount(BottomSheet, { props: { open: true }, slots: { default: 'Body' }, attachTo: document.body })
    await flushPromises()
    expect(document.querySelector('[role="dialog"] .bs-close')).not.toBeNull()
  })
})
