<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Pill from '@/components/ui/Pill.vue'
import SelectableTile from '@/components/ui/SelectableTile.vue'
import IconImage from '@/components/ui/icons/IconImage.vue'
import { imageThumbUrl } from './imageThumb'
import type { TableImage } from '@/types/stage'
import { t } from '@/locales'

const props = defineProps<{
  image: TableImage
  selected: boolean
  /** The image shown at the table. */
  shown: boolean
}>()
defineEmits<{ (e: 'select'): void }>()

const broken = ref(false)
watch(() => props.image.file, () => { broken.value = false })
const thumb = computed(() => (broken.value ? null : imageThumbUrl(props.image)))
</script>

<template>
  <SelectableTile
    class="it"
    size="compact"
    :selected="selected"
    :aria-current="shown ? 'true' : undefined"
    @select="$emit('select')"
  >
    <span :class="['it-pic', { 'is-empty': !thumb }]">
      <img v-if="thumb" :src="thumb" alt="" @error="broken = true">
      <IconImage v-else :size="20" />
      <Pill v-if="shown" class="it-mark" tone="accent" size="sm" dot>{{ t('stage.images.tile.shown') }}</Pill>
    </span>
    <span :class="['it-caption', { 'is-none': !image.caption }]" :title="image.caption ?? undefined">
      {{ image.caption || t('stage.images.tile.noCaption') }}
    </span>
  </SelectableTile>
</template>

<style scoped>
/* A button is as wide as its content unless told: the caption must stay inside the cell. */
.it { width: 100%; min-width: 0; }
.it-pic {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border-radius: var(--r-sm);
  background: var(--vtt-bg-sunken);
}
/* Cropped in the master's grid only; players see the whole picture. */
.it-pic img { width: 100%; height: 100%; object-fit: cover; display: block; }
.it-pic.is-empty { border: 1px dashed var(--vtt-border-strong); color: var(--vtt-text-muted); }
.it-mark { position: absolute; left: 4px; top: 4px; max-width: calc(100% - 8px); }
.it-caption {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 1.3;
  color: var(--vtt-text-secondary);
}
.it-caption.is-none { color: var(--vtt-text-muted); font-style: italic; }
</style>
