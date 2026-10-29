<script setup lang="ts">
import { computed, reactive, ref, useId, watch } from 'vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import Button from '@/components/ui/Button.vue'
import FormCheckbox from '@/components/ui/FormCheckbox.vue'
import { checkItem, copyName, type LibraryProblem } from '@/domain/library'
import type { ItemDescriptor } from '@/types/character'
import { LIBRARY_LIMITS, type LibraryItem } from '@/types/library'
import { t } from '@/locales'

export type ItemSheetMode = 'add' | 'edit' | 'duplicate'
export type ItemDraft = Omit<LibraryItem, 'id'>

const props = defineProps<{
  mode: ItemSheetMode
  /** The entry being edited or copied; ignored when adding. */
  source: LibraryItem | null
  saving?: boolean
  failed?: boolean
}>()
const emit = defineEmits<{ (e: 'save', draft: ItemDraft): void }>()
const open = defineModel<boolean>('open', { required: true })

type Kind = ItemDescriptor['kind']
type ArmorClass = 'none' | 'light' | 'full'
type Field = 'name' | 'damage' | 'price' | 'quantity' | 'notes'

const KINDS: Kind[] = ['weapon', 'armor', 'shield', 'tool', 'gear', 'occult', 'custom']

const form = reactive({
  name: '',
  kind: 'weapon' as Kind,
  melee: true,
  armorClass: 'light' as ArmorClass,
  damage: '',
  price: '',
  consumable: false,
  quantity: '',
  notes: '',
})
// Field errors wait for the first save attempt, then follow the typing.
const tried = ref(false)
const uid = useId()
const fieldId = (f: string) => `${uid}-${f}`

const canConsume = computed(() => form.kind === 'gear' || form.kind === 'occult' || form.kind === 'custom')

function reset() {
  const s = props.mode === 'add' ? null : props.source
  const d = s?.descriptor
  form.name = s ? (props.mode === 'duplicate' ? copyName(s.name, name => t('library.items.copyName', { name })) : s.name) : ''
  form.kind = d?.kind ?? 'weapon'
  form.melee = d?.kind === 'weapon' ? d.melee : true
  form.armorClass = d?.kind === 'armor' ? d.class : 'light'
  form.damage = s?.damage ?? ''
  form.price = s?.price !== undefined ? String(s.price) : ''
  form.consumable = !!d && 'consumable' in d && d.consumable === true
  form.quantity = s?.quantity !== undefined ? String(s.quantity) : ''
  form.notes = s?.notes ?? ''
  tried.value = false
}

watch(open, v => { if (v) reset() }, { immediate: true })

// Digits only become numbers; anything else stays text, so the shape check reports it as not a whole number.
function toInt(raw: string): number | string | undefined {
  const v = raw.trim()
  if (!v) return undefined
  return /^\d{1,6}$/.test(v) ? Number(v) : v
}

function descriptor(): ItemDescriptor {
  switch (form.kind) {
    case 'weapon': return { kind: 'weapon', melee: form.melee }
    case 'armor': return { kind: 'armor', class: form.armorClass }
    case 'shield': return { kind: 'shield' }
    case 'tool': return { kind: 'tool' }
    default: return form.consumable ? { kind: form.kind, consumable: true } : { kind: form.kind }
  }
}

const check = computed(() => checkItem({
  id: 'draft',
  name: form.name,
  descriptor: descriptor(),
  damage: form.damage,
  price: toInt(form.price),
  notes: form.notes,
  quantity: canConsume.value && form.consumable ? toInt(form.quantity) : undefined,
}))

function problemText(p: LibraryProblem): string {
  switch (p.field) {
    case 'name':
      return p.key === 'tooLong' ? t('library.items.form.tooLong', { max: LIBRARY_LIMITS.name }) : t('library.items.form.nameRequired')
    case 'damage':
      return t('library.items.form.damageFormat')
    case 'price':
      return t('library.items.form.priceRange', { max: LIBRARY_LIMITS.priceMax })
    case 'quantity':
      return t('library.items.form.quantityRange', { max: LIBRARY_LIMITS.quantityMax })
    default:
      return t('library.items.form.tooLong', { max: LIBRARY_LIMITS.notes })
  }
}

const errors = computed<Partial<Record<Field, string>>>(() => {
  const c = check.value
  if (!tried.value || c.ok) return {}
  const out: Partial<Record<Field, string>> = {}
  for (const p of c.problems) {
    const f = p.field as Field
    if (!out[f]) out[f] = problemText(p)
  }
  return out
})

const title = computed(() => {
  if (props.mode === 'edit') return t('library.items.form.titleEdit')
  if (props.mode === 'duplicate') return t('library.items.form.titleDuplicate')
  return t('library.items.form.titleAdd')
})

function submit() {
  if (props.saving) return
  tried.value = true
  const c = check.value
  if (!c.ok) return
  const { id: _id, ...draft } = c.value
  emit('save', draft)
}
</script>

<template>
  <BottomSheet v-model:open="open" :title="title" :max-width="480">
    <form :id="`${uid}-form`" class="its-form" novalidate @submit.prevent="submit">
      <div class="its-row">
        <label class="its-label" :for="fieldId('name')">{{ t('library.items.form.name') }}</label>
        <input
          :id="fieldId('name')"
          v-model="form.name"
          class="its-input"
          type="text"
          autocomplete="off"
          :placeholder="t('library.items.form.namePlaceholder')"
          :aria-invalid="!!errors.name"
          :aria-describedby="errors.name ? `${fieldId('name')}-err` : undefined"
        >
        <p v-if="errors.name" :id="`${fieldId('name')}-err`" class="its-error">{{ errors.name }}</p>
      </div>

      <div class="its-grid">
        <div class="its-row">
          <label class="its-label" :for="fieldId('kind')">{{ t('library.items.form.kind') }}</label>
          <select :id="fieldId('kind')" v-model="form.kind" class="its-input">
            <option v-for="k in KINDS" :key="k" :value="k">{{ t(`library.items.form.kinds.${k}`) }}</option>
          </select>
        </div>
        <div v-if="form.kind === 'weapon'" class="its-row">
          <label class="its-label" :for="fieldId('reach')">{{ t('library.items.form.reach') }}</label>
          <select :id="fieldId('reach')" v-model="form.melee" class="its-input">
            <option :value="true">{{ t('library.items.melee') }}</option>
            <option :value="false">{{ t('library.items.ranged') }}</option>
          </select>
        </div>
        <div v-else-if="form.kind === 'armor'" class="its-row">
          <label class="its-label" :for="fieldId('armorClass')">{{ t('library.items.form.armorClass') }}</label>
          <select :id="fieldId('armorClass')" v-model="form.armorClass" class="its-input">
            <option value="none">{{ t('library.items.form.armorNone') }}</option>
            <option value="light">{{ t('library.items.form.armorLight') }}</option>
            <option value="full">{{ t('library.items.form.armorFull') }}</option>
          </select>
        </div>
      </div>

      <div class="its-grid">
        <div class="its-row">
          <label class="its-label" :for="fieldId('damage')">{{ t('library.items.form.damage') }}</label>
          <input
            :id="fieldId('damage')"
            v-model="form.damage"
            class="its-input its-num"
            type="text"
            autocomplete="off"
            autocapitalize="off"
            :placeholder="t('library.items.form.damagePlaceholder')"
            :aria-invalid="!!errors.damage"
            :aria-describedby="errors.damage ? `${fieldId('damage')}-err` : undefined"
          >
        </div>
        <div class="its-row">
          <label class="its-label" :for="fieldId('price')">{{ t('library.items.form.price') }}</label>
          <input
            :id="fieldId('price')"
            v-model="form.price"
            class="its-input its-num"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            :placeholder="t('library.items.form.pricePlaceholder')"
            :aria-invalid="!!errors.price"
            :aria-describedby="errors.price ? `${fieldId('price')}-err` : undefined"
          >
        </div>
      </div>
      <!-- Short fields share a row, so their messages go under it. -->
      <p v-if="errors.damage" :id="`${fieldId('damage')}-err`" class="its-error">{{ t('library.items.form.damage') }}: {{ errors.damage }}</p>
      <p v-if="errors.price" :id="`${fieldId('price')}-err`" class="its-error">{{ t('library.items.form.price') }}: {{ errors.price }}</p>

      <div v-if="canConsume" class="its-grid its-consume">
        <FormCheckbox v-model="form.consumable">{{ t('library.items.form.consumable') }}</FormCheckbox>
        <div v-if="form.consumable" class="its-row">
          <label class="its-label" :for="fieldId('quantity')">{{ t('library.items.form.quantity') }}</label>
          <input
            :id="fieldId('quantity')"
            v-model="form.quantity"
            class="its-input its-num"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            placeholder="1"
            :aria-invalid="!!errors.quantity"
            :aria-describedby="errors.quantity ? `${fieldId('quantity')}-err` : undefined"
          >
        </div>
      </div>
      <p v-if="errors.quantity" :id="`${fieldId('quantity')}-err`" class="its-error">{{ t('library.items.form.quantity') }}: {{ errors.quantity }}</p>

      <div class="its-row">
        <label class="its-label" :for="fieldId('notes')">{{ t('library.items.form.notes') }}</label>
        <textarea
          :id="fieldId('notes')"
          v-model="form.notes"
          class="its-input its-textarea"
          rows="3"
          :placeholder="t('library.items.form.notesPlaceholder')"
          :aria-invalid="!!errors.notes"
          :aria-describedby="errors.notes ? `${fieldId('notes')}-err` : undefined"
        />
        <p v-if="errors.notes" :id="`${fieldId('notes')}-err`" class="its-error">{{ errors.notes }}</p>
      </div>

      <p v-if="failed" class="its-error" role="alert">{{ t('library.items.form.saveFailed') }}</p>
    </form>

    <template #footer>
      <Button variant="ghost" @click="open = false">{{ t('common.cancel') }}</Button>
      <Button variant="hero" type="submit" :form="`${uid}-form`" :disabled="saving">
        {{ mode === 'edit' ? t('common.save') : t('library.items.form.add') }}
      </Button>
    </template>
  </BottomSheet>
</template>

<style scoped>
.its-form { display: flex; flex-direction: column; gap: 12px; }
.its-row { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.its-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; align-items: end; }
.its-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
}
.its-input {
  width: 100%;
  min-width: 0;
  padding: 9px 12px;
  background: var(--vtt-bg-sunken);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-sm);
  color: var(--vtt-text-primary);
  font-family: var(--font-sans);
  /* 16px keeps iOS Safari from zooming into the field. */
  font-size: 16px;
  outline: none;
}
.its-input::placeholder { color: var(--vtt-text-muted); font-style: italic; }
.its-input:focus {
  border-color: var(--vtt-border-gold);
  box-shadow: 0 0 0 2px rgba(140, 106, 58, 0.15);
}
.its-input[aria-invalid='true'] { border-color: var(--vtt-danger); }
.its-input.its-num { font-family: var(--font-mono); }
.its-textarea { font-family: var(--font-serif); resize: vertical; min-height: 56px; }
.its-error { margin: 0; font-family: var(--font-serif); font-size: 13px; color: var(--vtt-danger-bright); }
</style>
