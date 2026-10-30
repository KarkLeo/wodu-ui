<script setup lang="ts">
import { computed, reactive, ref, useId, watch } from 'vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import Button from '@/components/ui/Button.vue'
import FormCheckbox from '@/components/ui/FormCheckbox.vue'
import FormError from '@/components/ui/FormError.vue'
import SelectField from '@/components/ui/SelectField.vue'
import TextareaField from '@/components/ui/TextareaField.vue'
import TextField from '@/components/ui/TextField.vue'
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

const kindOptions = computed(() => KINDS.map(k => ({ value: k, label: t(`library.items.form.kinds.${k}`) })))
const reachOptions = computed(() => [
  { value: true, label: t('library.items.melee') },
  { value: false, label: t('library.items.ranged') },
])
const armorOptions = computed<Array<{ value: ArmorClass; label: string }>>(() => [
  { value: 'none', label: t('library.items.form.armorNone') },
  { value: 'light', label: t('library.items.form.armorLight') },
  { value: 'full', label: t('library.items.form.armorFull') },
])

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
      <TextField
        v-model="form.name"
        :label="t('library.items.form.name')"
        :placeholder="t('library.items.form.namePlaceholder')"
        :error="errors.name"
      />

      <div class="its-grid">
        <SelectField v-model="form.kind" :label="t('library.items.form.kind')" :options="kindOptions" />
        <SelectField v-if="form.kind === 'weapon'" v-model="form.melee" :label="t('library.items.form.reach')" :options="reachOptions" />
        <SelectField
          v-else-if="form.kind === 'armor'"
          v-model="form.armorClass"
          :label="t('library.items.form.armorClass')"
          :options="armorOptions"
        />
      </div>

      <!-- Short fields share a row, so each message names its field. -->
      <div class="its-grid">
        <TextField
          v-model="form.damage"
          mono
          autocapitalize="off"
          :label="t('library.items.form.damage')"
          :placeholder="t('library.items.form.damagePlaceholder')"
          :error="errors.damage && `${t('library.items.form.damage')}: ${errors.damage}`"
        />
        <TextField
          v-model="form.price"
          mono
          inputmode="numeric"
          :label="t('library.items.form.price')"
          :placeholder="t('library.items.form.pricePlaceholder')"
          :error="errors.price && `${t('library.items.form.price')}: ${errors.price}`"
        />
      </div>

      <div v-if="canConsume" class="its-grid">
        <FormCheckbox v-model="form.consumable" :class="{ 'its-beside': form.consumable }">{{ t('library.items.form.consumable') }}</FormCheckbox>
        <TextField
          v-if="form.consumable"
          v-model="form.quantity"
          mono
          inputmode="numeric"
          placeholder="1"
          :label="t('library.items.form.quantity')"
          :error="errors.quantity && `${t('library.items.form.quantity')}: ${errors.quantity}`"
        />
      </div>

      <TextareaField
        v-model="form.notes"
        :label="t('library.items.form.notes')"
        :placeholder="t('library.items.form.notesPlaceholder')"
        :error="errors.notes"
      />

      <FormError v-if="failed" role="alert">{{ t('library.items.form.saveFailed') }}</FormError>
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
.its-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; align-items: start; }
/* Level with the bottom of the quantity input (label row, gap, input), also while an error shows under it. */
.its-beside { margin-top: calc(var(--s-6) + var(--s-2)); }
</style>
