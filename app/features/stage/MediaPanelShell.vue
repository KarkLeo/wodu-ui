<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from '@/components/ui/Button.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import IconPlus from '@/components/ui/icons/IconPlus.vue'
import StateNote from '@/components/ui/StateNote.vue'
import { retryMedia } from '@/composables/useMediaSession'
import { MEDIA_LIMITS } from '@/domain/stage'
import { t } from '@/locales'

const props = defineProps<{
  kind: 'scenes' | 'sounds'
  status: 'idle' | 'loading' | 'ready' | 'failed'
  /** How many entries the list holds. */
  count: number
}>()
const emit = defineEmits<{ (e: 'add'): void }>()

const max = computed(() => MEDIA_LIMITS[props.kind])
const atLimit = computed(() => props.count >= max.value)
const addRef = ref<{ $el: HTMLElement } | null>(null)

defineExpose({ focusAdd: () => addRef.value?.$el.focus() })

const text = (part: 'title' | 'count' | 'add' | 'loading' | 'loadFailed' | 'retry' | 'empty' | 'limitReached', params?: Record<string, number>) =>
  t(`stage.${props.kind}.${part}`, params)
</script>

<template>
  <section class="sp" :aria-label="text('title')">
    <header class="sp-head">
      <h2 class="sp-title">{{ text('title') }}</h2>
      <span v-if="status === 'ready'" class="sp-count">{{ text('count', { count, max }) }}</span>
      <Button
        v-if="status === 'ready'"
        ref="addRef"
        variant="dashed"
        size="sm"
        :icon-left="IconPlus"
        :disabled="atLimit"
        @click="emit('add')"
      >
        {{ text('add') }}
      </Button>
    </header>

    <div class="sp-body">
      <StateNote v-if="status === 'loading' || status === 'idle'" size="sm" role="status">{{ text('loading') }}</StateNote>
      <StateNote v-else-if="status === 'failed'" size="sm" role="alert">
        {{ text('loadFailed') }}
        <template #action>
          <Button variant="ghost" size="sm" @click="retryMedia">{{ text('retry') }}</Button>
        </template>
      </StateNote>
      <template v-else-if="status === 'ready'">
        <!-- Above the list: at the limit the list is long and the note would scroll out of sight. -->
        <StateNote v-if="atLimit" size="sm" inline>{{ text('limitReached', { max }) }}</StateNote>
        <EmptyState v-if="!count" :hint="text('empty')" />
        <slot v-else />
      </template>
    </div>

    <slot v-if="status === 'ready' && count" name="footer" />
    <slot name="sheets" />
  </section>
</template>

<style scoped>
.sp {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  border-radius: var(--r-lg);
  background: var(--vtt-surface-a88);
  box-shadow: 0 0 0 1px var(--vtt-gold-a35);
  overflow: hidden;
}
.sp-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  /* Room on the right for the column's close button. */
  padding: 12px 40px 10px 14px;
  border-bottom: 1px solid var(--vtt-border-subtle);
}
.sp-title {
  margin: 0;
  font-family: var(--font-serif);
  font-weight: 500;
  font-size: 20px;
  color: var(--vtt-text-primary);
}
.sp-count {
  flex: 1 1 auto;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--vtt-text-muted);
}
.sp-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
