<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import Button from '@/components/ui/Button.vue'
import FileField from '@/components/ui/FileField.vue'
import FormError from '@/components/ui/FormError.vue'
import StateNote from '@/components/ui/StateNote.vue'
import TextField from '@/components/ui/TextField.vue'
import { useMediaSave } from '@/composables/useMediaSave'
import { useStageControl } from '@/composables/useStageControl'
import { useMediaStore } from '@/stores/media'
import { CAPTION_MAX, IMAGE_MAX_BYTES, IMAGE_TYPES, checkImageDraft, checkUpload } from '@/domain/stage'
import { createImage, MediaWriteError, republishImage, updateImage } from '@/transport/media'
import type { TableImage } from '@/types/stage'
import { ImageFitError } from '@/utils/fitImage'
import { imageThumbUrl } from './imageThumb'
import { t } from '@/locales'

const props = defineProps<{
  gameId: string
  /** The image being edited; a new one when absent. */
  image?: TableImage
}>()
const open = defineModel<boolean>('open', { required: true })

const MB = 1024 * 1024
const uid = useId()
const { shownImageId } = useStageControl()

const caption = ref('')
const file = ref<File | null>(null)
// The stored picture the form will replace on save.
const removeFile = ref(false)
const fileError = ref('')
const { saving, progress, failure, failureText, saved, republishing, sheetOpen, reset: resetSave, run, retryPublish } = useMediaSave('images', open, {
  publish: { failed: 'stage.images.form.publishFailed', stillFailed: 'stage.images.form.publishStillFailed' },
})

function reset() {
  resetSave()
  caption.value = props.image?.caption ?? ''
  file.value = null
  removeFile.value = false
  fileError.value = ''
}

watch(open, (v) => { if (v) reset() }, { immediate: true })

const hasFile = computed(() => file.value !== null || (!!props.image && !removeFile.value))
const problems = computed(() => checkImageDraft({ caption: caption.value, hasFile: hasFile.value }))
const canSave = computed(() => !saving.value && problems.value.length === 0)
// Counted as the domain counts it, on the trimmed text.
const length = computed(() => caption.value.trim().length)
const captionError = computed(() => (problems.value.includes('captionTooLong') ? t('stage.images.form.captionTooLong', { max: CAPTION_MAX }) : undefined))
const missing = computed(() => (problems.value.includes('noFile') ? t('stage.images.form.needFile') : ''))
const missingId = `${uid}-missing`

const stored = computed(() => (props.image && !removeFile.value && !file.value ? t('stage.images.form.imageAttached') : undefined))
const storedThumb = computed(() => (stored.value && props.image ? imageThumbUrl(props.image) : undefined))
const onTheTable = computed(() => props.image !== undefined && shownImageId.value === props.image.id)

function pickFile(picked: File | null) {
  fileError.value = ''
  // A picture over the size limit is fine: it is shrunk on save.
  if (picked && checkUpload('image', picked) === 'type') {
    fileError.value = t('stage.images.form.wrongImageType')
    return
  }
  file.value = picked
}

function clearStored() {
  fileError.value = ''
  removeFile.value = true
}

function refused(err: unknown): boolean {
  if (err instanceof ImageFitError) {
    fileError.value = t(err.kind === 'decode' ? 'stage.images.form.imageUnreadable' : 'stage.images.form.imageCannotFit')
    return true
  }
  if (err instanceof MediaWriteError && err.kind === 'fileRefused') {
    fileError.value = t(err.refusal?.reason === 'size' ? 'stage.images.form.imageTooLarge' : 'stage.images.form.wrongImageType', { mb: IMAGE_MAX_BYTES / MB })
    return true
  }
  return false
}

async function submit() {
  if (!canSave.value) return
  // Deleted elsewhere since the sheet opened (the master's other device): there is nothing left to save, as for a sound.
  const media = useMediaStore()
  if (props.image && !(media.gameId === props.gameId && media.images.list.some(i => i.id === props.image!.id))) {
    open.value = false
    return
  }
  fileError.value = ''
  const text = caption.value.trim() || null
  await run(async ({ id, onProgress }) => {
    if (props.image) await updateImage(props.gameId, { id: props.image.id, caption: text }, file.value ?? undefined, onProgress)
    else if (file.value) await createImage(props.gameId, { id, caption: text }, file.value, onProgress)
  }, refused)
}

const publish = () => retryPublish(image => republishImage(props.gameId, image))
</script>

<template>
  <BottomSheet
    v-model:open="sheetOpen"
    :title="image ? t('stage.images.form.titleEdit') : t('stage.images.form.titleAdd')"
    :max-width="480"
  >
    <form :id="`${uid}-form`" class="im-form" novalidate @submit.prevent="submit">
      <fieldset class="im-fields" :disabled="saved !== null">
        <FileField
          :model-value="file"
          :label="t('stage.images.form.image')"
          :accept="[...IMAGE_TYPES]"
          :hint="t('stage.images.form.imageHint', { mb: IMAGE_MAX_BYTES / MB })"
          :error="fileError || undefined"
          :progress="saving && file ? progress : null"
          :current-name="stored"
          :current-thumb="storedThumb"
          @update:model-value="pickFile"
          @clear="clearStored"
        />
        <TextField v-model="caption" :label="t('stage.images.form.caption')" :error="captionError">
          <template #hint>{{ t('stage.images.form.captionCount', { count: length, max: CAPTION_MAX }) }}</template>
        </TextField>
      </fieldset>

      <StateNote v-if="onTheTable && !saved" size="sm" inline align="start">{{ t('stage.images.form.onTheTable') }}</StateNote>
      <StateNote v-if="missing && !saving && !saved" :id="missingId" size="sm" inline align="start">{{ missing }}</StateNote>

      <div v-if="failure" class="im-failure">
        <FormError role="alert">{{ failureText }}</FormError>
        <Button v-if="saved" variant="ghost" size="sm" :disabled="republishing" @click="publish">
          {{ t('stage.images.form.publishRetry') }}
        </Button>
      </div>
    </form>

    <template #footer>
      <template v-if="saved">
        <Button variant="ghost" @click="open = false">{{ t('stage.images.form.close') }}</Button>
      </template>
      <template v-else>
        <Button variant="ghost" :disabled="saving" @click="open = false">{{ t('common.cancel') }}</Button>
        <Button variant="hero" type="submit" :form="`${uid}-form`" :disabled="!canSave" :aria-describedby="missing ? missingId : undefined">
          {{ image ? t('common.save') : t('stage.images.form.add') }}
        </Button>
      </template>
    </template>
  </BottomSheet>
</template>

<style scoped>
.im-form { display: flex; flex-direction: column; gap: 12px; }
.im-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.im-failure { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
</style>
