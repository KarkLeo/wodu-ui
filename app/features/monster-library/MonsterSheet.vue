<script setup lang="ts">
import { computed, reactive, ref, useId, watch } from 'vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import Button from '@/components/ui/Button.vue'
import { checkMonster, type LibraryProblem } from '@/domain/library'
import { LIBRARY_LIMITS, type LibraryMonster } from '@/types/library'
import { t } from '@/locales'

export type MonsterSheetMode = 'add' | 'edit' | 'duplicate'
export type MonsterDraft = Omit<LibraryMonster, 'id'>

const props = defineProps<{
  mode: MonsterSheetMode
  /** The entry being edited or copied; ignored when adding. */
  source: LibraryMonster | null
  saving?: boolean
  failed?: boolean
}>()
const emit = defineEmits<{ (e: 'save', draft: MonsterDraft): void }>()
const open = defineModel<boolean>('open', { required: true })

type Field = 'name' | 'hp' | 'armor' | 'damage' | 'special' | 'notes'

const form = reactive<Record<Field, string>>({ name: '', hp: '', armor: '0', damage: '', special: '', notes: '' })
// Field errors wait for the first save attempt, then follow the typing.
const tried = ref(false)
const uid = useId()
const fieldId = (f: Field) => `${uid}-${f}`

function reset() {
  const s = props.mode === 'add' ? null : props.source
  form.name = s ? (props.mode === 'duplicate' ? t('library.monsters.copyName', { name: s.name }) : s.name) : ''
  form.hp = s ? String(s.hp) : ''
  form.armor = s ? String(s.armor) : '0'
  form.damage = s?.damage ?? ''
  form.special = s?.special ?? ''
  form.notes = s?.notes ?? ''
  tried.value = false
}

watch(open, v => { if (v) reset() }, { immediate: true })

// Digits only become numbers; anything else stays text, so the shape check reports it as not a whole number.
function toInt(raw: string): number | string {
  const v = raw.trim()
  return /^\d{1,6}$/.test(v) ? Number(v) : v
}

const check = computed(() => checkMonster({
  id: 'draft',
  name: form.name,
  hp: toInt(form.hp),
  armor: toInt(form.armor),
  damage: form.damage,
  special: form.special,
  notes: form.notes,
}))

function problemText(p: LibraryProblem): string {
  switch (p.field) {
    case 'name':
      return p.key === 'tooLong' ? t('library.monsters.form.tooLong', { max: LIBRARY_LIMITS.name }) : t('library.monsters.form.nameRequired')
    case 'hp':
      return t('library.monsters.form.hpRange', { max: LIBRARY_LIMITS.hpMax })
    case 'armor':
      return t('library.monsters.form.armorRange', { max: LIBRARY_LIMITS.armorMax })
    case 'damage':
      return t('library.monsters.form.damageFormat')
    case 'special':
      return t('library.monsters.form.tooLong', { max: LIBRARY_LIMITS.special })
    default:
      return t('library.monsters.form.tooLong', { max: LIBRARY_LIMITS.notes })
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
  if (props.mode === 'edit') return t('library.monsters.form.titleEdit')
  if (props.mode === 'duplicate') return t('library.monsters.form.titleDuplicate')
  return t('library.monsters.form.titleAdd')
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
    <form :id="`${uid}-form`" class="ms-form" novalidate @submit.prevent="submit">
      <div class="ms-row">
        <label class="ms-label" :for="fieldId('name')">{{ t('library.monsters.form.name') }}</label>
        <input
          :id="fieldId('name')"
          v-model="form.name"
          class="ms-input"
          type="text"
          autocomplete="off"
          :placeholder="t('library.monsters.form.namePlaceholder')"
          :aria-invalid="!!errors.name"
          :aria-describedby="errors.name ? `${fieldId('name')}-err` : undefined"
        >
        <p v-if="errors.name" :id="`${fieldId('name')}-err`" class="ms-error">{{ errors.name }}</p>
      </div>

      <div class="ms-grid">
        <div class="ms-row">
          <label class="ms-label" :for="fieldId('hp')">{{ t('library.monsters.form.hp') }}</label>
          <input
            :id="fieldId('hp')"
            v-model="form.hp"
            class="ms-input is-num"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            :aria-invalid="!!errors.hp"
            :aria-describedby="errors.hp ? `${fieldId('hp')}-err` : undefined"
          >
        </div>
        <div class="ms-row">
          <label class="ms-label" :for="fieldId('armor')">{{ t('library.monsters.form.armor') }}</label>
          <input
            :id="fieldId('armor')"
            v-model="form.armor"
            class="ms-input is-num"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            :aria-invalid="!!errors.armor"
            :aria-describedby="errors.armor ? `${fieldId('armor')}-err` : undefined"
          >
        </div>
        <div class="ms-row">
          <label class="ms-label" :for="fieldId('damage')">{{ t('library.monsters.form.damage') }}</label>
          <input
            :id="fieldId('damage')"
            v-model="form.damage"
            class="ms-input is-num"
            type="text"
            autocomplete="off"
            autocapitalize="off"
            :placeholder="t('library.monsters.form.damagePlaceholder')"
            :aria-invalid="!!errors.damage"
            :aria-describedby="errors.damage ? `${fieldId('damage')}-err` : undefined"
          >
        </div>
      </div>
      <!-- The three short fields share one row, so their messages go under it. -->
      <p v-if="errors.hp" :id="`${fieldId('hp')}-err`" class="ms-error">{{ t('library.monsters.form.hp') }}: {{ errors.hp }}</p>
      <p v-if="errors.armor" :id="`${fieldId('armor')}-err`" class="ms-error">{{ t('library.monsters.form.armor') }}: {{ errors.armor }}</p>
      <p v-if="errors.damage" :id="`${fieldId('damage')}-err`" class="ms-error">{{ t('library.monsters.form.damage') }}: {{ errors.damage }}</p>

      <div class="ms-row">
        <label class="ms-label" :for="fieldId('special')">{{ t('library.monsters.form.special') }}</label>
        <textarea
          :id="fieldId('special')"
          v-model="form.special"
          class="ms-input ms-textarea"
          rows="2"
          :placeholder="t('library.monsters.form.specialPlaceholder')"
          :aria-invalid="!!errors.special"
          :aria-describedby="errors.special ? `${fieldId('special')}-err` : undefined"
        />
        <p v-if="errors.special" :id="`${fieldId('special')}-err`" class="ms-error">{{ errors.special }}</p>
      </div>

      <div class="ms-row">
        <label class="ms-label" :for="fieldId('notes')">{{ t('library.monsters.form.notes') }}</label>
        <textarea
          :id="fieldId('notes')"
          v-model="form.notes"
          class="ms-input ms-textarea"
          rows="3"
          :placeholder="t('library.monsters.form.notesPlaceholder')"
          :aria-invalid="!!errors.notes"
          :aria-describedby="errors.notes ? `${fieldId('notes')}-err` : undefined"
        />
        <p v-if="errors.notes" :id="`${fieldId('notes')}-err`" class="ms-error">{{ errors.notes }}</p>
      </div>

      <p v-if="failed" class="ms-error" role="alert">{{ t('library.monsters.form.saveFailed') }}</p>
    </form>

    <template #footer>
      <Button variant="ghost" @click="open = false">{{ t('common.cancel') }}</Button>
      <Button variant="hero" type="submit" :form="`${uid}-form`" :disabled="saving">
        {{ mode === 'edit' ? t('common.save') : t('library.monsters.form.add') }}
      </Button>
    </template>
  </BottomSheet>
</template>

<style scoped>
.ms-form { display: flex; flex-direction: column; gap: 12px; }
.ms-row { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.ms-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.ms-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
}
.ms-input {
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
.ms-input::placeholder { color: var(--vtt-text-muted); font-style: italic; }
.ms-input:focus {
  border-color: var(--vtt-border-gold);
  box-shadow: 0 0 0 2px rgba(140, 106, 58, 0.15);
}
.ms-input[aria-invalid='true'] { border-color: var(--vtt-danger); }
.ms-input.is-num { font-family: var(--font-mono); }
.ms-textarea { font-family: var(--font-serif); resize: vertical; min-height: 56px; }
.ms-error { margin: 0; font-family: var(--font-serif); font-size: 13px; color: var(--vtt-danger-bright); }
</style>
