<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import FormField from './FormField.vue'
import IconClose from './icons/IconClose.vue'
import Thumbnail from './Thumbnail.vue'
import { t } from '@/locales'

const props = defineProps<{
  label: string
  /** MIME types the picker offers. */
  accept: string[]
  hint?: string
  error?: string
  /** 0..1 while an upload runs: shows a bar and disables the control. Null or absent otherwise. */
  progress?: number | null
  /** Name of a file already stored, shown while no new file is picked. */
  currentName?: string
  /** Image URL of the stored file. */
  currentThumb?: string
  disabled?: boolean
}>()

const model = defineModel<File | null>({ required: true })
const emit = defineEmits<{ clear: [] }>()

const input = ref<HTMLInputElement | null>(null)
const chooseButton = ref<HTMLButtonElement | null>(null)
const removeButton = ref<HTMLButtonElement | null>(null)

const uploading = computed(() => typeof props.progress === 'number')
const percent = computed(() => Math.round(Math.min(1, Math.max(0, props.progress ?? 0)) * 100))
const locked = computed(() => props.disabled || uploading.value)

function onPick(event: Event) {
  const el = event.target as HTMLInputElement
  const file = el.files?.[0] ?? null
  // Cleared so that picking the same file again after removing it still fires `change`.
  el.value = ''
  if (!file) return
  model.value = file
  void focusAfterRender()
}

function unpick() {
  model.value = null
  void focusAfterRender()
}

function clearStored() {
  emit('clear')
  void focusAfterRender()
}

// The control that had focus leaves the DOM when the state changes; focus goes to whichever one the field shows then.
async function focusAfterRender() {
  await nextTick()
  const target = removeButton.value ?? chooseButton.value
  target?.focus()
}

const removeName = computed(() => `${t('ui.fileField.remove')}: ${props.label}`)
const chooseName = computed(() => `${t('ui.fileField.choose')}: ${props.label}`)

function formatSize(bytes: number): string {
  const round = (n: number) => Number(n.toFixed(1))
  if (bytes < 1024) return t('ui.fileField.sizeB', { n: bytes })
  if (bytes < 1024 * 1024) return t('ui.fileField.sizeKb', { n: round(bytes / 1024) })
  return t('ui.fileField.sizeMb', { n: round(bytes / (1024 * 1024)) })
}
</script>

<template>
  <FormField :label="label" :error="error" :hint="hint">
    <template #default="{ id, invalid, describedBy }">
      <div :class="['file-field', { 'is-invalid': invalid, 'is-disabled': locked }]">
        <input
          :id="id"
          ref="input"
          type="file"
          class="file-input"
          tabindex="-1"
          :accept="accept.join(',')"
          :disabled="locked"
          :aria-invalid="invalid"
          :aria-describedby="describedBy"
          @change="onPick"
        >
        <div v-if="model" class="file-row">
          <div class="file-text">
            <span class="file-name">{{ model.name }}</span>
            <span class="file-meta">{{ formatSize(model.size) }}</span>
          </div>
          <button
            type="button"
            class="file-remove"
            ref="removeButton"
            :aria-label="removeName"
            :disabled="locked"
            @click="unpick"
          >
            <IconClose :size="12" />
          </button>
        </div>
        <div v-else-if="currentName" class="file-row">
          <Thumbnail v-if="currentThumb" class="file-thumb" :src="currentThumb" width="36px" height="36px" :icon-size="14" />
          <div class="file-text">
            <span class="file-name">{{ currentName }}</span>
          </div>
          <button
            type="button"
            class="file-remove"
            ref="removeButton"
            :aria-label="removeName"
            :disabled="locked"
            @click="clearStored"
          >
            <IconClose :size="12" />
          </button>
        </div>
        <button
          v-else
          type="button"
          ref="chooseButton"
          class="file-choose"
          :aria-label="chooseName"
          :aria-invalid="invalid"
          :disabled="locked"
          :aria-describedby="describedBy"
          @click="input?.click()"
        >
          {{ t('ui.fileField.choose') }}
        </button>
        <div
          v-if="uploading"
          class="file-progress"
          role="progressbar"
          :aria-label="label"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="percent"
        >
          <div class="file-progress-fill" :style="{ width: `${percent}%` }" />
        </div>
      </div>
    </template>
  </FormField>
</template>

<style scoped>
.file-field { position: relative; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  border: 0;
  opacity: 0;
}
.file-choose {
  width: 100%;
  padding: 14px 12px;
  background: transparent;
  border: 1px dashed var(--vtt-border-strong);
  border-radius: var(--r-sm);
  color: var(--vtt-text-secondary);
  font-family: var(--font-sans);
  font-size: 14px;
  cursor: pointer;
  transition: border-color var(--t-fast) var(--ease), color var(--t-fast) var(--ease);
}
.file-choose:hover:not(:disabled) { border-color: var(--vtt-border-gold); color: var(--vtt-accent-soft); }
.file-choose:focus-visible { outline: 2px solid var(--vtt-accent); outline-offset: 2px; }
.file-choose:disabled { opacity: 0.5; cursor: not-allowed; }
.is-invalid .file-choose,
.is-invalid .file-row { border-color: var(--vtt-danger); }
.file-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 8px 8px 12px;
  background: var(--vtt-bg-sunken);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-sm);
}
.is-disabled .file-row { opacity: 0.6; }
.file-thumb {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
}
.file-text { display: flex; flex: 1; flex-direction: column; min-width: 0; }
.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--vtt-text-primary);
  font-size: 14px;
}
.file-meta { font-family: var(--font-mono); font-size: 11px; color: var(--vtt-text-muted); }
.file-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: var(--r-pill);
  color: var(--vtt-text-muted);
  cursor: pointer;
  transition: color var(--t-fast) var(--ease);
}
.file-remove:hover:not(:disabled) { color: var(--vtt-accent); }
.file-remove:focus-visible { outline: 2px solid var(--vtt-accent); outline-offset: 0; }
.file-remove:disabled { cursor: not-allowed; }
.file-progress {
  height: 6px;
  overflow: hidden;
  background: var(--vtt-bg-sunken);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-pill);
}
.file-progress-fill {
  height: 100%;
  background: var(--vtt-accent);
  transition: width var(--t-fast) var(--ease);
}
</style>
