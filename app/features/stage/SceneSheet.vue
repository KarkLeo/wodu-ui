<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import Button from '@/components/ui/Button.vue'
import FileField from '@/components/ui/FileField.vue'
import FormError from '@/components/ui/FormError.vue'
import StateNote from '@/components/ui/StateNote.vue'
import TextField from '@/components/ui/TextField.vue'
import {
  AUDIO_MAX_BYTES, AUDIO_TYPES, IMAGE_MAX_BYTES, IMAGE_TYPES, MEDIA_LIMITS, SCENE_NAME_MAX,
  checkSceneDraft, checkUpload,
} from '@/domain/stage'
import { createScene, republishScene, SceneWriteError, updateScene, type SceneFiles } from '@/transport/media'
import type { Scene } from '@/types/stage'
import { createLogger } from '@/utils/logger'
import { sceneThumbUrl } from './sceneThumb'
import { t } from '@/locales'

const log = createLogger('scene-sheet')

const props = defineProps<{
  gameId: string
  /** The scene being edited; a new one when absent. */
  scene?: Scene
}>()
const open = defineModel<boolean>('open', { required: true })

const MB = 1024 * 1024
const uid = useId()

const name = ref('')
const image = ref<File | null>(null)
const sound = ref<File | null>(null)
// A stored file the form will remove on save.
const removeImage = ref(false)
const removeSound = ref(false)
const imageError = ref('')
const soundError = ref('')
const saving = ref(false)
const progress = ref(0)
type Failure = 'limitReached' | 'limitMayHaveChanged' | 'notMaster' | 'publishFailed' | 'saveFailed'
const failure = ref<Failure | null>(null)
// Set once the scene is saved but the table did not get it: the form is over, only the table's update is left.
const savedScene = ref<Scene | null>(null)
const republishFailed = ref(false)
const republishing = ref(false)
// One id for every try of one form, so a try after a lost answer cannot add the scene twice.
let draftId = crypto.randomUUID()
let attempt = 0

function reset() {
  attempt++
  draftId = crypto.randomUUID()
  name.value = props.scene?.name ?? ''
  image.value = null
  sound.value = null
  removeImage.value = false
  removeSound.value = false
  imageError.value = ''
  soundError.value = ''
  saving.value = false
  failure.value = null
  savedScene.value = null
  republishFailed.value = false
  republishing.value = false
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

const hasImage = computed(() => image.value !== null || (!!props.scene?.image && !removeImage.value))
const hasSound = computed(() => sound.value !== null || (!!props.scene?.sound && !removeSound.value))
const problems = computed(() => checkSceneDraft({ name: name.value, hasImage: hasImage.value, hasSound: hasSound.value }))
const canSave = computed(() => !saving.value && problems.value.length === 0)
const missing = computed(() => {
  const out: string[] = []
  if (problems.value.some(p => p === 'nameRequired' || p === 'nameTooLong')) out.push(t('stage.scenes.form.needName'))
  if (problems.value.includes('noFiles')) out.push(t('stage.scenes.form.needFile'))
  return out.join(' ')
})
const missingId = `${uid}-missing`

const storedImage = computed(() => (props.scene?.image && !removeImage.value && !image.value ? t('stage.scenes.form.imageAttached') : undefined))
const storedSound = computed(() => (props.scene?.sound && !removeSound.value && !sound.value ? t('stage.scenes.form.soundAttached') : undefined))
const storedThumb = computed(() => (storedImage.value && props.scene ? sceneThumbUrl(props.scene) ?? undefined : undefined))

function pickImage(file: File | null) {
  imageError.value = ''
  // A picture over the size limit is fine: it is shrunk on save.
  if (file && checkUpload('image', file) === 'type') {
    imageError.value = t('stage.scenes.form.wrongImageType')
    return
  }
  image.value = file
}

function pickSound(file: File | null) {
  soundError.value = ''
  if (file) {
    const verdict = checkUpload('audio', file)
    if (verdict === 'type') {
      soundError.value = t('stage.scenes.form.wrongSoundType')
      return
    }
    if (verdict === 'size') {
      soundError.value = t('stage.scenes.form.soundTooLarge', { mb: AUDIO_MAX_BYTES / MB })
      return
    }
  }
  sound.value = file
}

function clearImage() {
  imageError.value = ''
  removeImage.value = true
}

function clearSound() {
  soundError.value = ''
  removeSound.value = true
}

const failureText = computed(() => {
  switch (failure.value) {
    case 'limitReached':
    case 'limitMayHaveChanged':
      return t(`stage.scenes.form.${failure.value}`, { max: MEDIA_LIMITS.scenes })
    case 'publishFailed':
      return t(republishFailed.value ? 'stage.scenes.form.publishStillFailed' : 'stage.scenes.form.publishFailed')
    case 'notMaster':
    case 'saveFailed':
      return t(`stage.scenes.form.${failure.value}`)
    default:
      return ''
  }
})

function files(): SceneFiles {
  const out: SceneFiles = {}
  const nextImage = image.value ?? (props.scene && removeImage.value ? null : undefined)
  const nextSound = sound.value ?? (props.scene && removeSound.value ? null : undefined)
  if (nextImage !== undefined) out.image = nextImage
  if (nextSound !== undefined) out.sound = nextSound
  return out
}

async function submit() {
  if (!canSave.value) return
  const mine = attempt
  failure.value = null
  imageError.value = ''
  soundError.value = ''
  saving.value = true
  progress.value = 0
  const onProgress = (fraction: number) => { if (mine === attempt) progress.value = fraction }
  try {
    if (props.scene) await updateScene(props.gameId, { id: props.scene.id, name: name.value }, files(), onProgress)
    else await createScene(props.gameId, { id: draftId, name: name.value }, files(), onProgress)
    if (mine !== attempt) return
    saving.value = false
    open.value = false
  } catch (err) {
    if (mine !== attempt) return
    saving.value = false
    if (err instanceof SceneWriteError) {
      // The session ended under the upload: there is nobody to tell.
      if (err.kind === 'aborted') return
      if (err.kind === 'fileRefused') {
        const { field, reason } = err.refusal ?? { field: 'image', reason: 'type' }
        const text = field === 'image'
          ? t(reason === 'type' ? 'stage.scenes.form.wrongImageType' : 'stage.scenes.form.imageTooLarge', { mb: IMAGE_MAX_BYTES / MB })
          : t(reason === 'type' ? 'stage.scenes.form.wrongSoundType' : 'stage.scenes.form.soundTooLarge', { mb: AUDIO_MAX_BYTES / MB })
        if (field === 'image') imageError.value = text
        else soundError.value = text
        return
      }
      if (err.kind === 'stagePublishFailed' && err.scene) {
        savedScene.value = err.scene
        failure.value = 'publishFailed'
        return
      }
      if (err.kind !== 'stagePublishFailed') {
        failure.value = err.kind
        return
      }
    }
    log.error('save failed', { err })
    failure.value = 'saveFailed'
  }
}

async function retryPublish() {
  const scene = savedScene.value
  if (!scene || republishing.value) return
  const mine = attempt
  republishing.value = true
  try {
    await republishScene(props.gameId, scene)
    if (mine === attempt) open.value = false
  } catch (err) {
    log.error('republish failed', { err })
    if (mine === attempt) republishFailed.value = true
  } finally {
    if (mine === attempt) republishing.value = false
  }
}
</script>

<template>
  <BottomSheet
    v-model:open="sheetOpen"
    :title="scene ? t('stage.scenes.form.titleEdit') : t('stage.scenes.form.titleAdd')"
    :max-width="480"
  >
    <form :id="`${uid}-form`" class="ss-form" novalidate @submit.prevent="submit">
      <fieldset class="ss-fields" :disabled="savedScene !== null">
        <TextField
          v-model="name"
          :label="t('stage.scenes.form.name')"
          :placeholder="t('stage.scenes.form.namePlaceholder')"
          :maxlength="SCENE_NAME_MAX"
        />
        <FileField
          :model-value="image"
          :label="t('stage.scenes.form.image')"
          :accept="[...IMAGE_TYPES]"
          :hint="t('stage.scenes.form.imageHint', { mb: IMAGE_MAX_BYTES / MB })"
          :error="imageError || undefined"
          :progress="saving && image ? progress : null"
          :current-name="storedImage"
          :current-thumb="storedThumb"
          @update:model-value="pickImage"
          @clear="clearImage"
        />
        <FileField
          :model-value="sound"
          :label="t('stage.scenes.form.sound')"
          :accept="[...AUDIO_TYPES]"
          :hint="t('stage.scenes.form.soundHint', { mb: AUDIO_MAX_BYTES / MB })"
          :error="soundError || undefined"
          :progress="saving && sound ? progress : null"
          :current-name="storedSound"
          @update:model-value="pickSound"
          @clear="clearSound"
        />
      </fieldset>

      <StateNote v-if="missing && !saving && !savedScene" :id="missingId" size="sm" inline align="start">{{ missing }}</StateNote>

      <div v-if="failure" class="ss-failure">
        <FormError role="alert">{{ failureText }}</FormError>
        <Button v-if="savedScene" variant="ghost" size="sm" :disabled="republishing" @click="retryPublish">
          {{ t('stage.scenes.form.publishRetry') }}
        </Button>
      </div>
    </form>

    <template #footer>
      <template v-if="savedScene">
        <Button variant="ghost" @click="open = false">{{ t('stage.scenes.form.close') }}</Button>
      </template>
      <template v-else>
        <Button variant="ghost" :disabled="saving" @click="open = false">{{ t('common.cancel') }}</Button>
        <Button variant="hero" type="submit" :form="`${uid}-form`" :disabled="!canSave" :aria-describedby="missing ? missingId : undefined">
          {{ scene ? t('common.save') : t('stage.scenes.form.add') }}
        </Button>
      </template>
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
