<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ label: string }>()

// A monster's number is part of its name ("Goblin #2"); a long name is cut short but the number never is.
const parts = computed(() => {
  const m = /^(.*\S)(\s+#\d+)$/.exec(props.label)
  return m ? { name: m[1]!, n: m[2]! } : { name: props.label, n: '' }
})
</script>

<template>
  <span class="numbered-name" :title="label"><span class="numbered-name-text">{{ parts.name }}</span><span v-if="parts.n" class="numbered-name-n">{{ parts.n }}</span></span>
</template>

<style scoped>
.numbered-name {
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
