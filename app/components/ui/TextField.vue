<script setup lang="ts">
import { ref } from 'vue'
import FormField from './FormField.vue'
import IconEye from './icons/IconEye.vue'
import IconEyeOff from './icons/IconEyeOff.vue'
import { t } from '@/locales'

withDefaults(defineProps<{
  label: string
  error?: string
  optional?: string
  hint?: string
  hideLabel?: boolean
  variant?: 'box' | 'underline'
  /** `sm` for tight rows: less padding and a smaller placeholder; the typed text stays 16px. */
  size?: 'md' | 'sm'
  /** Monospace text, for dice formulas and numbers. */
  mono?: boolean
  /**
   * Masks the text until the eye button shows it, for something a neighbour should not read off the screen.
   * Not a password field, so the browser never offers to save it.
   */
  secret?: boolean
  type?: 'text' | 'email' | 'url' | 'tel'
  inputmode?: 'text' | 'numeric' | 'decimal' | 'email' | 'url' | 'tel'
  maxlength?: number
  placeholder?: string
  autocomplete?: string
  autocapitalize?: string
  spellcheck?: boolean
  /** Id of a `<datalist>` with suggestions. */
  list?: string
}>(), {
  type: 'text',
  autocomplete: 'off',
  variant: 'box',
  size: 'md',
  spellcheck: undefined,
})

const model = defineModel<string>({ required: true })
const emit = defineEmits<{ blur: [event: FocusEvent] }>()

const revealed = ref(false)
</script>

<template>
  <FormField
    :label="label"
    :error="error"
    :optional="optional"
    :hint="hint"
    :hide-label="hideLabel"
    :variant="variant"
  >
    <template #default="{ id, invalid, describedBy }">
      <div :class="['text-field', { 'has-reveal': secret }]">
        <input
          :id="id"
          v-model="model"
          :class="['form-field-control', {
            'is-mono': mono,
            'is-underline': variant === 'underline',
            'is-sm': size === 'sm',
            'is-masked': secret && !revealed,
          }]"
          :type="type"
          :inputmode="inputmode"
          :maxlength="maxlength"
          :placeholder="placeholder"
          :autocomplete="autocomplete"
          :autocapitalize="autocapitalize"
          :spellcheck="secret ? false : spellcheck"
          :list="list"
          :aria-invalid="invalid"
          :aria-describedby="describedBy"
          :data-1p-ignore="secret || undefined"
          :data-lpignore="secret || undefined"
          @blur="emit('blur', $event)"
        >
        <button
          v-if="secret"
          type="button"
          class="text-field-reveal"
          :aria-label="t('ui.textField.show')"
          :aria-pressed="revealed"
          :aria-controls="id"
          @click="revealed = !revealed"
        >
          <component :is="revealed ? IconEye : IconEyeOff" :size="14" />
        </button>
      </div>
    </template>
    <template v-if="$slots.hint" #hint><slot name="hint" /></template>
  </FormField>
</template>

<style scoped>
.text-field { position: relative; display: flex; min-width: 0; }
.text-field.has-reveal .form-field-control { padding-right: 40px; }
/* Masks like a password field without being one, so no password manager steps in. */
.form-field-control.is-masked { -webkit-text-security: disc; }
.text-field-reveal {
  position: absolute;
  top: 50%;
  right: 6px;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: var(--r-pill);
  color: var(--vtt-text-muted);
  cursor: pointer;
  transition: color var(--t-fast) var(--ease);
}
.text-field-reveal:hover,
.text-field-reveal[aria-pressed='true'] { color: var(--vtt-accent); }
.text-field-reveal:focus-visible { outline: 2px solid var(--vtt-accent); outline-offset: 0; }
</style>
