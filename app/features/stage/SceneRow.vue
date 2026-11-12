<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import Button from '@/components/ui/Button.vue'
import IconButton from '@/components/ui/IconButton.vue'
import Pill from '@/components/ui/Pill.vue'
import IconEdit from '@/components/ui/icons/IconEdit.vue'
import IconImage from '@/components/ui/icons/IconImage.vue'
import IconMusic from '@/components/ui/icons/IconMusic.vue'
import IconTrash from '@/components/ui/icons/IconTrash.vue'
import { useBusyFocus } from '@/composables/useBusyFocus'
import { sceneThumbUrl } from './sceneThumb'
import type { Scene } from '@/types/stage'
import { t } from '@/locales'

const props = defineProps<{
  scene: Scene
  /** The scene on at the table. */
  active: boolean
  /** A change for this scene is on its way. */
  busy: boolean
}>()
const emit = defineEmits<{
  (e: 'turn-on'): void
  (e: 'turn-off'): void
  (e: 'edit'): void
  (e: 'delete'): void
}>()

function toggle() {
  if (props.active) emit('turn-off')
  else emit('turn-on')
}

const nameId = useId()
const broken = ref(false)
watch(() => props.scene.image, () => { broken.value = false })
const thumb = computed(() => (broken.value ? null : sceneThumbUrl(props.scene)))

const mainRef = ref<{ $el: HTMLElement } | null>(null)
const editRef = ref<{ $el: HTMLElement } | null>(null)
const deleteRef = ref<{ $el: HTMLElement } | null>(null)
useBusyFocus(() => props.busy, [mainRef, editRef, deleteRef])

defineExpose({ focusDelete: () => deleteRef.value?.$el.focus() })
</script>

<template>
  <li :class="['sr', { 'is-on': active }]" :aria-current="active ? 'true' : undefined">
    <div class="sr-inner">
      <div :class="['sr-thumb', { 'is-empty': !thumb }]">
        <img v-if="thumb" :src="thumb" alt="" @error="broken = true">
        <IconImage v-else :size="16" />
      </div>
      <div class="sr-text">
        <span :id="nameId" class="sr-name">{{ scene.name }}</span>
        <span v-if="active || scene.sound" class="sr-meta">
          <Pill v-if="active" tone="accent" size="sm" dot>{{ t('stage.scenes.row.on') }}</Pill>
          <span v-if="scene.sound" class="sr-sound" role="img" :aria-label="t('stage.scenes.row.hasSound')">
            <IconMusic :size="12" />
          </span>
        </span>
      </div>
      <div class="sr-actions">
        <Button
          ref="mainRef"
          :variant="active ? 'ghost' : 'primary'"
          size="sm"
          :disabled="busy"
          :aria-describedby="nameId"
          @click="toggle"
        >
          {{ active ? t('stage.scenes.row.turnOff') : t('stage.scenes.row.turnOn') }}
        </Button>
        <IconButton
          ref="editRef"
          variant="square"
          :label="t('stage.scenes.row.edit', { name: scene.name })"
          :disabled="busy"
          @click="emit('edit')"
        >
          <IconEdit :size="14" />
        </IconButton>
        <IconButton
          ref="deleteRef"
          variant="square"
          tone="danger"
          :label="t('stage.scenes.row.delete', { name: scene.name })"
          :disabled="busy"
          @click="emit('delete')"
        >
          <IconTrash :size="14" />
        </IconButton>
      </div>
    </div>
  </li>
</template>

<style scoped>
.sr {
  list-style: none;
  container-type: inline-size;
  border-radius: var(--r-md);
  background: var(--vtt-elevated-a72);
  box-shadow: inset 0 0 0 1px var(--vtt-border-strong);
  transition: box-shadow var(--t-fast) var(--ease), background var(--t-fast) var(--ease);
}
.sr.is-on {
  background: var(--vtt-elevated-a96);
  box-shadow: inset 0 0 0 1px var(--vtt-accent), 0 0 16px var(--vtt-accent-a35);
}
.sr-inner {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px 10px;
  padding: 8px 10px;
}
.sr-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 38px;
  overflow: hidden;
  border-radius: var(--r-sm);
  background: var(--vtt-bg-sunken);
}
.sr-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.sr-thumb.is-empty {
  border: 1px dashed var(--vtt-border-strong);
  color: var(--vtt-text-muted);
}
.sr-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.sr-name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  color: var(--vtt-text-primary);
}
.sr-meta { display: flex; align-items: center; gap: 8px; min-width: 0; }
.sr-sound { display: inline-flex; color: var(--vtt-text-muted); }
.is-on .sr-sound { color: var(--vtt-accent-soft); }
.sr-actions { display: flex; align-items: center; gap: 6px; }

/* Too narrow for the name and the buttons side by side: the buttons take a line of their own. */
@container (max-width: 330px) {
  .sr-inner { grid-template-columns: auto minmax(0, 1fr); }
  .sr-actions { grid-column: 1 / -1; justify-content: flex-end; }
}
</style>
