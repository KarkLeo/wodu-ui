import { describe, it, expect, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import SkillChip from './SkillChip.vue'
import Stepper from './Stepper.vue'
import FormCheckbox from './FormCheckbox.vue'
import Switch from './Switch.vue'
import Slider from './Slider.vue'
import FileField from './FileField.vue'
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

describe('Switch', () => {
  it('is a switch named by its label, also with the label hidden', () => {
    wrapper = mount(Switch, { props: { modelValue: true, label: 'Loop', hideLabel: true } })
    const control = wrapper.find('[role="switch"]')
    expect(control.attributes('aria-label')).toBe('Loop')
    expect(control.attributes('aria-checked')).toBe('true')
    expect(wrapper.text()).toBe('')
  })

  it('can be disabled', () => {
    wrapper = mount(Switch, { props: { modelValue: false, label: 'Loop', disabled: true } })
    expect(wrapper.find('[role="switch"]').attributes('disabled')).toBeDefined()
  })
})

describe('Slider', () => {
  it('exposes one named slider thumb with its range', () => {
    wrapper = mount(Slider, { props: { modelValue: 0.5, ariaLabel: 'Volume' }, attachTo: document.body })
    const thumbs = wrapper.findAll('[role="slider"]')
    expect(thumbs).toHaveLength(1)
    expect(thumbs[0]!.attributes('aria-label')).toBe('Volume')
    expect(thumbs[0]!.attributes('aria-valuemin')).toBe('0')
    expect(thumbs[0]!.attributes('aria-valuemax')).toBe('1')
  })
})

describe('FileField', () => {
  it('labels the native input, wires the error and marks it invalid', () => {
    wrapper = mount(FileField, { props: { modelValue: null, label: 'Image', accept: ['image/png', 'image/webp'], error: 'Too large' } })
    const input = wrapper.find('input[type="file"]')
    expect(wrapper.find('label').attributes('for')).toBe(input.attributes('id'))
    expect(input.attributes('accept')).toBe('image/png,image/webp')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')).toBe(wrapper.find('.form-error').attributes('id'))
  })

  it('reports the upload as a progressbar in percent and locks the input', () => {
    wrapper = mount(FileField, { props: { modelValue: null, label: 'Image', accept: [], progress: 0.256 } })
    const bar = wrapper.find('[role="progressbar"]')
    expect(bar.attributes('aria-valuemin')).toBe('0')
    expect(bar.attributes('aria-valuemax')).toBe('100')
    expect(bar.attributes('aria-valuenow')).toBe('26')
    expect(wrapper.find('input').attributes('disabled')).toBeDefined()
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
