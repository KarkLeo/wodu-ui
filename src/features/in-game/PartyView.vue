<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCharactersStore } from '@/stores/characters'
import IconClose from '@/components/ui/icons/IconClose.vue'
import { t } from '@/locales'
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

// Держим activeId в синхроне с открытыми листами: если активный закрылся
// или вошли в роут со свежим набором ids — активируем первый из списка.
watch(ids, (list) => {
  if (list.length === 0) {
    store.setActive(null)
    return
  }
  if (!store.activeId || !list.includes(store.activeId)) {
    store.setActive(list[0]!)
  }
}, { immediate: true })

function closePanel(id: string) {
  const remaining = ids.value.filter(x => x !== id)
  if (store.activeId === id) {
    store.setActive(remaining[0] ?? null)
  }
  if (remaining.length === 0) {
    router.replace('/')
  } else {
    router.replace(`/party/${remaining.join(',')}`)
  }
}
</script>

<template>
  <div class="party-center">
    <article
      v-for="id in ids"
      :key="id"
      :class="['sheet-column', { 'is-active': id === store.activeId }]"
      @mousedown="store.setActive(id)"
    >
      <button
        type="button"
        class="sheet-close"
        :aria-label="t('gameLayout.sheetColumn.close')"
        @click.stop="closePanel(id)"
      >
        <IconClose :size="14" />
      </button>
      <div class="sheet-column-body">
        <InGameView :id="id" />
      </div>
    </article>
  </div>
</template>

<style scoped>
.party-center {
  display: flex;
  align-items: stretch;
  justify-content: safe center;
  gap: var(--s-4);
  padding: var(--s-4) 0;
  height: 100%;
  scroll-snap-type: x proximity;
}
.party-center::before,
.party-center::after {
  content: "";
  flex-shrink: 0;
  pointer-events: none;
}
.party-center::before { flex-basis: calc(var(--gl-left-w) + var(--s-4)); }
.party-center::after  { flex-basis: calc(var(--gl-right-w) + var(--s-4)); }

.sheet-column {
  width: 440px;
  flex: 0 0 440px;
  display: flex;
  flex-direction: column;
  background: linear-gradient(to bottom, rgba(36, 28, 21, 0.78), rgba(26, 21, 16, 0.82));
  backdrop-filter: blur(14px) saturate(1.2);
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
  border-radius: var(--r-lg);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(140, 106, 58, 0.2);
  overflow: hidden;
  scroll-snap-align: start;
  position: relative;
}
.sheet-column.is-active {
  box-shadow:
    0 8px 28px rgba(0, 0, 0, 0.55),
    0 0 0 1px var(--vtt-border-gold),
    0 0 24px rgba(212, 168, 87, 0.1);
}

.sheet-close {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 10;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--vtt-border-subtle);
  color: var(--vtt-text-muted);
  cursor: pointer;
  border-radius: var(--r-pill);
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease), background var(--t-fast) var(--ease);
}
.sheet-close:hover {
  color: var(--vtt-accent-soft);
  border-color: var(--vtt-border-strong);
  background: rgba(7, 5, 10, 0.3);
}

.sheet-column-body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
}
.sheet-column-body :deep(.app-shell) {
  background: transparent;
}

@media (max-width: 960px) {
  .party-center {
    gap: 0;
    padding: 10px 0 20px;
    scroll-snap-type: x mandatory;
  }
  .party-center::before,
  .party-center::after { flex-basis: 0; }
  .sheet-column {
    width: calc(100vw - 28px);
    flex-basis: calc(100vw - 28px);
    min-width: 280px;
    max-width: 440px;
    scroll-snap-align: center;
    margin: 0 14px;
  }
}
</style>
