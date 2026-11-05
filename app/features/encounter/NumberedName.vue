<script setup lang="ts">
import { computed } from 'vue'
import Tooltip from '@/components/ui/Tooltip.vue'

const props = defineProps<{
  label: string
  /** No tooltip of its own: something around it already says the whole name. */
  plain?: boolean
}>()

function isCut(el: HTMLElement) {
  const text = el.querySelector('.numbered-name-text')
  return !!text && text.scrollWidth > text.clientWidth
}

// A monster's number is part of its name ("Goblin #2"); a long name is cut short but the number never is.
const parts = computed(() => {
  const m = /^(.*\S)(\s+#\d+)$/.exec(props.label)
  return m ? { name: m[1]!, n: m[2]! } : { name: props.label, n: '' }
})
</script>

<template>
  <span class="numbered-name">
    <Tooltip :text="label" :check="isCut" :disabled="plain">
      <span class="numbered-name-parts"><span class="numbered-name-text">{{ parts.name }}</span><span v-if="parts.n" class="numbered-name-n">{{ parts.n }}</span></span>
    </Tooltip>
  </span>
</template>

<style scoped>
.numbered-name,
.numbered-name-parts {
  display: inline-flex;
  min-width: 0;
  max-width: 100%;
  white-space: nowrap;
}
.numbered-name-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.numbered-name-n {
  flex-shrink: 0;
  white-space: pre;
}
</style>
