<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import IconButton from '@/components/ui/IconButton.vue'
import Pill from '@/components/ui/Pill.vue'
import Switch from '@/components/ui/Switch.vue'
import IconEdit from '@/components/ui/icons/IconEdit.vue'
import IconPlay from '@/components/ui/icons/IconPlay.vue'
import IconStop from '@/components/ui/icons/IconStop.vue'
import IconTrash from '@/components/ui/icons/IconTrash.vue'
import { formatDuration } from '@/domain/stage'
import type { Sound } from '@/types/stage'
import { t } from '@/locales'

const props = withDefaults(defineProps<{
  sound: Sound
  /** The sound playing at the table. */
  playing: boolean
  /** A play, stop or delete for this sound is on its way. */
  busy?: boolean
  /** The loop value to show while a change is being saved; the stored one otherwise. */
  loop?: boolean
  /** The loop change is being saved. */
  loopSaving?: boolean
  /** The sound plays now with the loop value it started with, and the stored one differs. */
  loopNextPlay?: boolean
}>(), {
  // Left undefined unless set: an absent boolean would read as false and hide the stored value.
  loop: undefined,
})
const emit = defineEmits<{
  (e: 'play'): void
  (e: 'stop'): void
  (e: 'toggle-loop', value: boolean): void
  (e: 'edit'): void
  (e: 'delete'): void
}>()

const loopModel = computed({
  get: () => props.loop ?? props.sound.loop,
  set: (value: boolean) => emit('toggle-loop', value),
})

function toggle() {
  if (props.playing) emit('stop')
  else emit('play')
}

// A disabled button drops the focus, so a keyboard user gets it back on the same button when the change is over.
const playRef = ref<{ $el: HTMLElement } | null>(null)
const editRef = ref<{ $el: HTMLElement } | null>(null)
const deleteRef = ref<{ $el: HTMLElement } | null>(null)
let focused: { $el: HTMLElement } | null = null
watch(() => props.busy, async (busy) => {
  if (busy) {
    const active = document.activeElement
    focused = [playRef, editRef, deleteRef].map(r => r.value).find(r => r?.$el === active) ?? null
    return
  }
  const target = focused
  focused = null
  await nextTick()
  if (target && (!document.activeElement || document.activeElement === document.body)) target.$el.focus()
})

defineExpose({ focusDelete: () => deleteRef.value?.$el.focus() })
</script>

<template>
  <li :class="['sr', { 'is-on': playing }]" :aria-current="playing ? 'true' : undefined">
    <div class="sr-inner">
      <IconButton
        ref="playRef"
        variant="round"
        size="lg"
        :pressed="playing"
        :label="playing ? t('stage.sounds.row.stop', { name: sound.name }) : t('stage.sounds.row.play', { name: sound.name })"
        :disabled="busy"
        @click="toggle"
      >
        <IconStop v-if="playing" :size="14" />
        <IconPlay v-else :size="14" />
      </IconButton>
      <div class="sr-text">
        <span class="sr-name">{{ sound.name }}</span>
        <span class="sr-meta">
          <span class="sr-duration">{{ formatDuration(sound.duration) }}</span>
          <Pill v-if="playing" tone="accent" size="sm" dot>{{ t('stage.sounds.row.playing') }}</Pill>
        </span>
        <span v-if="loopNextPlay" class="sr-note">{{ t('stage.sounds.row.loopNextPlay') }}</span>
      </div>
      <div class="sr-actions">
        <Switch v-model="loopModel" :label="t('stage.sounds.row.loop')" :disabled="loopSaving" hide-label />
        <IconButton
          ref="editRef"
          variant="square"
          :label="t('stage.sounds.row.edit', { name: sound.name })"
          :disabled="busy"
          @click="emit('edit')"
        >
          <IconEdit :size="14" />
        </IconButton>
        <IconButton
          ref="deleteRef"
          variant="square"
          tone="danger"
          :label="t('stage.sounds.row.delete', { name: sound.name })"
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
.sr-duration { font-family: var(--font-mono); font-size: 12px; color: var(--vtt-text-muted); }
.sr-note { font-size: 11px; color: var(--vtt-text-muted); }
.sr-actions { display: flex; align-items: center; gap: 8px; }

/* Too narrow for the name and the controls side by side: the controls take a line of their own. */
@container (max-width: 330px) {
  .sr-inner { grid-template-columns: auto minmax(0, 1fr); }
  .sr-actions { grid-column: 1 / -1; justify-content: flex-end; }
}
</style>
