<script setup lang="ts">
import { computed, useSlots, Fragment, type VNode } from 'vue'

const props = withDefaults(defineProps<{
  noFrame?: boolean
}>(), {
  noFrame: false,
})

const slots = useSlots()

const children = computed(() => {
  const raw = slots.default?.() ?? []
  const out: VNode[] = []
  for (const node of raw) {
    if (node.type === Fragment && Array.isArray(node.children)) {
      for (const c of node.children) {
        if (c && typeof c === 'object' && (c as VNode).type) out.push(c as VNode)
      }
    } else if (typeof node === 'object' && node.type) {
      out.push(node)
    }
  }
  return out
})
</script>

<template>
  <div :class="['sc-trio', { 'no-frame': props.noFrame }]">
    <template v-for="(node, idx) in children" :key="idx">
      <component :is="node" />
      <span v-if="idx < children.length - 1" class="sc-divider" />
    </template>
  </div>
</template>

<style scoped>
.sc-trio {
  display: inline-flex;
  align-items: stretch;
  gap: 0;
  padding: 2px;
  background: var(--vtt-bg-surface);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-sm);
  box-shadow: var(--shadow-1);
}
.sc-trio.no-frame {
  background: transparent;
  border: 0;
  box-shadow: none;
  padding: 0;
}
.sc-divider {
  align-self: stretch;
  width: 1px;
  background: var(--vtt-border-subtle);
  margin: 6px 0;
  opacity: 0.6;
}
</style>
