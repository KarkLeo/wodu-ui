<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCharactersStore } from '@/stores/characters'
import InGameView from './InGameView.vue'

const route = useRoute()
const router = useRouter()
const store = useCharactersStore()

const ids = computed(() => {
  const raw = (route.params.ids as string) ?? ''
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .filter(id => {
      const c = store.getById(id)
      return c && c.status !== 'draft'
    })
})

function closePanel(id: string) {
  const remaining = ids.value.filter(x => x !== id)
  if (remaining.length === 0) {
    router.replace('/')
  } else {
    router.replace(`/party/${remaining.join(',')}`)
  }
}
</script>

<template>
  <div class="party-wrap">
    <InGameView
      v-for="id in ids"
      :key="id"
      :id="id"
      class="party-panel"
      @close="closePanel(id)"
    />
  </div>
</template>

<style scoped>
.party-wrap {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  align-items: flex-start;
  min-height: 100vh;
  padding: 0 8px;
}
.party-wrap > :deep(.content-wrap) {
  flex: 0 0 480px;
  margin: 0;
  border-left: 1px solid var(--color-border);
  border-right: 1px solid var(--color-border);
}
</style>
