<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import SectionLabel from '@/components/ui/SectionLabel.vue'
import Button from '@/components/ui/Button.vue'
import StateNote from '@/components/ui/StateNote.vue'
import { t } from '@/locales'

const props = defineProps<{
  /** The picture's address; stories pass a generated one. */
  url: string
  caption: string | null
}>()
defineEmits<{ (e: 'open'): void }>()

const failed = ref(false)
const loaded = ref(false)
// A new element for every picture and every attempt: Try again asks for the picture again, and while a replacement
// loads the old picture is not left under the new caption.
const attempt = ref(0)
watch(() => props.url, () => {
  failed.value = false
  loaded.value = false
})

function retry() {
  failed.value = false
  loaded.value = false
  attempt.value++
}

const openLabel = computed(() => (props.caption ? t('stage.shown.openNamed', { caption: props.caption }) : t('stage.shown.openGeneric')))
</script>

<template>
  <div class="sic">
    <SectionLabel class="sic-title">{{ t('stage.shown.title') }}</SectionLabel>
    <StateNote v-if="failed" class="sic-failed" size="sm" compact>
      {{ t('stage.shown.failed') }}
      <template #action>
        <Button variant="ghost" size="sm" @click="retry">{{ t('stage.shown.retry') }}</Button>
      </template>
    </StateNote>
    <button
      v-else
      type="button"
      :class="['sic-open', { 'is-loading': !loaded }]"
      data-shown-image-open
      :aria-label="openLabel"
      @click="$emit('open')"
    >
      <StateNote v-if="!loaded" class="sic-loading" size="sm" compact>{{ t('stage.shown.loading') }}</StateNote>
      <img
        :key="`${attempt}:${url}`"
        :class="['sic-img', { 'is-pending': !loaded }]"
        :src="url"
        alt=""
        @load="loaded = true"
        @error="failed = true"
      >
    </button>
    <p v-if="caption" class="sic-caption">{{ caption }}</p>
  </div>
</template>

<style scoped>
.sic {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
  height: 100%;
  padding: var(--s-4);
  overflow-y: auto;
  min-width: 0;
}
.sic-open {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 0;
  background: var(--vtt-bg-sunken);
  border: 1px solid var(--vtt-border-strong);
  border-radius: var(--r-md);
  overflow: hidden;
  cursor: zoom-in;
  flex: 0 0 auto;
}
/* Until the picture is there, a quiet note in a frame of some height, not a thin empty button. */
.sic-open.is-loading { min-height: 120px; cursor: progress; }
.sic-loading { margin: 0; }
.sic-open:focus-visible {
  outline: 2px solid var(--vtt-accent);
  outline-offset: 2px;
}
/* The whole picture, never cropped nor stretched past its own size; a tall one stops at a height that keeps the card usable. */
.sic-img {
  display: block;
  width: auto;
  max-width: 100%;
  height: auto;
  max-height: min(60vh, 520px);
  object-fit: contain;
}
.sic-img.is-pending { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.sic-caption {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 16px;
  line-height: 1.4;
  color: var(--vtt-text-primary);
  overflow-wrap: anywhere;
}
</style>
