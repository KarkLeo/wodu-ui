<script setup lang="ts">
import { computed } from 'vue'
import Pill from '@/components/ui/Pill.vue'
import SelectableTile from '@/components/ui/SelectableTile.vue'
import Thumbnail from '@/components/ui/Thumbnail.vue'
import { imageThumbUrl } from './imageThumb'
import type { TableImage } from '@/types/stage'
import { t } from '@/locales'

const props = defineProps<{
  image: TableImage
  selected: boolean
  /** The image shown at the table. */
  shown: boolean
  /** Its place in the gallery, which names a tile that has no caption. */
  position: number
  total: number
}>()
defineEmits<{ (e: 'select'): void }>()

// A tile with no caption is told apart by its place, and the shown one says so.
const label = computed(() => {
  const name = props.image.caption || t('stage.images.tile.noCaptionAt', { n: props.position, total: props.total })
  return props.shown ? t('stage.images.tile.shownName', { name }) : name
})
</script>

<template>
  <SelectableTile
    class="it"
    size="compact"
    :selected="selected"
    :aria-label="label"
    :aria-current="shown ? 'true' : undefined"
    @select="$emit('select')"
  >
    <Thumbnail class="it-pic" :src="imageThumbUrl(image)" aspect="4 / 3">
      <Pill v-if="shown" class="it-mark" tone="accent" size="sm" dot>{{ t('stage.images.tile.shown') }}</Pill>
    </Thumbnail>
    <span :class="['it-caption', { 'is-none': !image.caption }]" :title="image.caption ?? undefined">
      {{ image.caption || t('stage.images.tile.noCaption') }}
    </span>
  </SelectableTile>
</template>

<style scoped>
/* A button is as wide as its content unless told: the caption must stay inside the cell. */
.it { width: 100%; min-width: 0; }
.it-pic { width: 100%; }
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
