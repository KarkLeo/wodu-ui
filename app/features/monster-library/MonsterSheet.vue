<script setup lang="ts">
import { computed, reactive, ref, useId, watch } from 'vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import Button from '@/components/ui/Button.vue'
import FormError from '@/components/ui/FormError.vue'
import TextareaField from '@/components/ui/TextareaField.vue'
import TextField from '@/components/ui/TextField.vue'
import { checkMonster, copyName, type LibraryProblem } from '@/domain/library'
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

function reset() {
  const s = props.mode === 'add' ? null : props.source
  form.name = s ? (props.mode === 'duplicate' ? copyName(s.name, name => t('library.monsters.copyName', { name })) : s.name) : ''
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
      <TextField
        v-model="form.name"
        :label="t('library.monsters.form.name')"
        :placeholder="t('library.monsters.form.namePlaceholder')"
        :error="errors.name"
      />

      <!-- The three short fields share one row, so each message names its field. -->
      <div class="ms-grid">
        <TextField
          v-model="form.hp"
          mono
          inputmode="numeric"
          :label="t('library.monsters.form.hp')"
          :error="errors.hp"
        />
        <TextField
          v-model="form.armor"
          mono
          inputmode="numeric"
          :label="t('library.monsters.form.armor')"
          :error="errors.armor"
        />
        <TextField
          v-model="form.damage"
          mono
          autocapitalize="off"
          :label="t('library.monsters.form.damage')"
          :placeholder="t('library.monsters.form.damagePlaceholder')"
          :error="errors.damage"
        />
      </div>

      <TextareaField
        v-model="form.special"
        :rows="2"
        :label="t('library.monsters.form.special')"
        :placeholder="t('library.monsters.form.specialPlaceholder')"
        :error="errors.special"
      />

      <TextareaField
        v-model="form.notes"
        :label="t('library.monsters.form.notes')"
        :placeholder="t('library.monsters.form.notesPlaceholder')"
        :error="errors.notes"
      />

      <FormError v-if="failed" role="alert">{{ t('library.monsters.form.saveFailed') }}</FormError>
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
.ms-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; align-items: start; }
</style>
