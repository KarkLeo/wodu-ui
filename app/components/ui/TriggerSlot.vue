<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const emit = defineEmits<{ (e: 'trigger'): void }>()

const root = ref<HTMLElement | null>(null)

function handler(e: Event) {
  e.preventDefault()
  emit('trigger')
}

onMounted(() => {
  const el = root.value
  if (!el) return
  const child = el.firstElementChild as HTMLElement | null
  if (!child) return
  child.addEventListener('click', handler)
})

onBeforeUnmount(() => {
  const el = root.value
  const child = el?.firstElementChild as HTMLElement | null
  child?.removeEventListener('click', handler)
})
</script>

<template>
  <div ref="root" class="trigger-slot">
    <slot />
  </div>
</template>

<style scoped>
.trigger-slot {
  display: contents;
}
</style>
