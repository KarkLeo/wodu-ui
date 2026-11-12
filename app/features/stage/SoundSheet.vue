<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import Button from '@/components/ui/Button.vue'
import FileField from '@/components/ui/FileField.vue'
import FormError from '@/components/ui/FormError.vue'
import StateNote from '@/components/ui/StateNote.vue'
import Switch from '@/components/ui/Switch.vue'
import TextField from '@/components/ui/TextField.vue'
import { AUDIO_MAX_BYTES, AUDIO_TYPES, MEDIA_LIMITS, SOUND_NAME_MAX, checkSoundDraft, checkUpload } from '@/domain/stage'
import { createSound, MediaWriteError, updateSound } from '@/transport/media'
import type { Sound } from '@/types/stage'
import { audioDuration } from '@/utils/audioDuration'
import { createLogger } from '@/utils/logger'
import { cutText } from '@/utils/text'
import { t } from '@/locales'

const log = createLogger('sound-sheet')

const props = defineProps<{
  gameId: string
  /** The sound being edited, by its name alone; a new one when absent. */
  sound?: Sound
}>()
const open = defineModel<boolean>('open', { required: true })

const MB = 1024 * 1024
const uid = useId()

const name = ref('')
// Set once the person types: a name they chose is never replaced by a file's.
const nameTyped = ref(false)
const file = ref<File | null>(null)
const loop = ref(false)
// The length of the picked file, read while the person fills in the rest; null when the browser cannot tell.
let duration: Promise<number | null> = Promise.resolve(null)
const fileError = ref('')
const saving = ref(false)
const progress = ref(0)
type Failure = 'limitReached' | 'limitMayHaveChanged' | 'notMaster' | 'saveFailed'
const failure = ref<Failure | null>(null)
// One id for every try of one form, so a try after a lost answer cannot add the sound twice.
let draftId = crypto.randomUUID()
let attempt = 0

function reset() {
  attempt++
  draftId = crypto.randomUUID()
  name.value = props.sound?.name ?? ''
  nameTyped.value = false
  file.value = null
  loop.value = false
  duration = Promise.resolve(null)
  fileError.value = ''
  saving.value = false
  failure.value = null
}

watch(open, (v) => { if (v) reset() }, { immediate: true })

// An upload that is under way is not abandoned by closing the sheet over it.
const sheetOpen = computed({
  get: () => open.value,
  set: (v: boolean) => {
    if (!v && saving.value) return
    open.value = v
  },
})

const problems = computed(() => checkSoundDraft({ name: name.value, hasFile: props.sound !== undefined || file.value !== null }))
const canSave = computed(() => !saving.value && problems.value.length === 0)
const missing = computed(() => {
  const out: string[] = []
  if (problems.value.some(p => p === 'nameRequired' || p === 'nameTooLong')) out.push(t('stage.sounds.form.needName'))
  if (problems.value.includes('noFile')) out.push(t('stage.sounds.form.needFile'))
  return out.join(' ')
})
const missingId = `${uid}-missing`

function typeName(value: string) {
  name.value = value
  nameTyped.value = true
}

function pickFile(picked: File | null) {
  fileError.value = ''
  if (!picked) {
    file.value = null
    duration = Promise.resolve(null)
    return
  }
  const verdict = checkUpload('audio', picked)
  if (verdict === 'type') {
    fileError.value = t('stage.sounds.form.wrongType')
    return
  }
  // Audio is sent as it is: one over the limit is refused, never shrunk.
  if (verdict === 'size') {
    fileError.value = t('stage.sounds.form.tooLarge', { mb: AUDIO_MAX_BYTES / MB })
    return
  }
  file.value = picked
  duration = audioDuration(picked)
  if (!nameTyped.value) name.value = cutText(picked.name.replace(/\.[^.]*$/, ''), SOUND_NAME_MAX)
}

const failureText = computed(() => {
  switch (failure.value) {
    case 'limitReached':
    case 'limitMayHaveChanged':
      return t(`stage.sounds.form.${failure.value}`, { max: MEDIA_LIMITS.sounds })
    case 'notMaster':
    case 'saveFailed':
      return t(`stage.sounds.form.${failure.value}`)
    default:
      return ''
  }
})

async function submit() {
  if (!canSave.value) return
  const mine = attempt
  failure.value = null
  fileError.value = ''
  saving.value = true
  progress.value = 0
  const onProgress = (fraction: number) => { if (mine === attempt) progress.value = fraction }
  try {
    if (props.sound) {
      await updateSound(props.gameId, { id: props.sound.id, name: name.value, loop: props.sound.loop, duration: props.sound.duration })
    } else {
      const picked = file.value
      if (!picked) return
      const length = await duration
      await createSound(props.gameId, { id: draftId, name: name.value, loop: loop.value, duration: length }, picked, onProgress)
    }
    if (mine !== attempt) return
    saving.value = false
    open.value = false
  } catch (err) {
    if (mine !== attempt) return
    saving.value = false
    if (err instanceof MediaWriteError) {
      // The session ended under the upload: there is nobody to tell.
      if (err.kind === 'aborted') return
      if (err.kind === 'fileRefused') {
        fileError.value = t(err.refusal?.reason === 'size' ? 'stage.sounds.form.tooLarge' : 'stage.sounds.form.wrongType', { mb: AUDIO_MAX_BYTES / MB })
        return
      }
      if (err.kind === 'limitReached' || err.kind === 'limitMayHaveChanged' || err.kind === 'notMaster') {
        failure.value = err.kind
        return
      }
    }
    log.error('save failed', { err })
    failure.value = 'saveFailed'
  }
}
</script>

<template>
  <BottomSheet
    v-model:open="sheetOpen"
    :title="sound ? t('stage.sounds.form.titleEdit') : t('stage.sounds.form.titleAdd')"
    :max-width="480"
  >
    <form :id="`${uid}-form`" class="ss-form" novalidate @submit.prevent="submit">
      <fieldset class="ss-fields">
        <FileField
          v-if="!sound"
          :model-value="file"
          :label="t('stage.sounds.form.file')"
          :accept="[...AUDIO_TYPES]"
          :hint="t('stage.sounds.form.fileHint', { mb: AUDIO_MAX_BYTES / MB })"
          :error="fileError || undefined"
          :progress="saving ? progress : null"
          @update:model-value="pickFile"
        />
        <TextField
          :model-value="name"
          :label="t('stage.sounds.form.name')"
          :placeholder="t('stage.sounds.form.namePlaceholder')"
          :maxlength="SOUND_NAME_MAX"
          @update:model-value="typeName"
        />
        <Switch v-if="!sound" v-model="loop" :label="t('stage.sounds.form.loop')" :disabled="saving" />
      </fieldset>

      <StateNote v-if="missing && !saving" :id="missingId" size="sm" inline align="start">{{ missing }}</StateNote>

      <div v-if="failure" class="ss-failure">
        <FormError role="alert">{{ failureText }}</FormError>
      </div>
    </form>

    <template #footer>
      <Button variant="ghost" :disabled="saving" @click="open = false">{{ t('common.cancel') }}</Button>
      <Button variant="hero" type="submit" :form="`${uid}-form`" :disabled="!canSave" :aria-describedby="missing ? missingId : undefined">
        {{ sound ? t('common.save') : t('stage.sounds.form.add') }}
      </Button>
    </template>
  </BottomSheet>
</template>

<style scoped>
.ss-form { display: flex; flex-direction: column; gap: 12px; }
.ss-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.ss-failure { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
</style>
