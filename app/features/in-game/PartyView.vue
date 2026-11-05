<script setup lang="ts">
import { computed, watch, ref, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCharactersStore } from '@/stores/characters'
import { useTable } from '@/composables/useTable'
import { useEncounterPanelShown, useTableSelection } from '@/composables/useTableSelection'
import { useEncounterStore } from '@/stores/encounter'
import EncounterPanel from '@/features/encounter/EncounterPanel.vue'
import IconClose from '@/components/ui/icons/IconClose.vue'
import IconButton from '@/components/ui/IconButton.vue'
import { t } from '@/locales'
import InGameView from './InGameView.vue'
import SheetActions from './SheetActions.vue'

const route = useRoute()
const router = useRouter()
const store = useCharactersStore()
const { gameId, partyRoute } = useTable()
const encounter = useEncounterStore()
const showEncounter = useEncounterPanelShown()
const { selection, selectCharacter } = useTableSelection()
// The panel's column comes first and counts as a card of the carousel.
const cardCount = computed(() => ids.value.length + (showEncounter.value ? 1 : 0))
const sheetOffset = computed(() => (showEncounter.value ? 1 : 0))

// In a game, a character that left it (taken out, its owner gone) drops out of the table at once,
// before the route re-check rewrites the URL.
const ids = computed(() => {
  const raw = (route.params.ids as string) ?? ''
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .filter(id => {
      const c = store.getById(id)
      if (!c || c.status === 'draft') return false
      return gameId.value === null || store.metaOf(id)?.game === gameId.value
    })
})

// Keep activeId in sync with the open sheets: if the active one closed,
// or we entered the route with a fresh set of ids — activate the first one.
watch(ids, (list) => {
  if (list.length === 0) {
    // On the game route with only the panel open there is no sheet to keep in sync.
    if (!showEncounter.value) store.setActive(null)
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
  router.replace(partyRoute(remaining))
}

// ── Slider indicator (mobile): track the most visible card ──
const scrollerRef = ref<HTMLElement | null>(null)
const itemEls = ref<HTMLElement[]>([])
const activeIndex = ref(0)

function setItemRef(el: Element | null, idx: number) {
  if (el instanceof HTMLElement) itemEls.value[idx] = el
}

function recalcActive() {
  const root = scrollerRef.value
  if (!root) return
  const center = root.scrollLeft + root.clientWidth / 2
  let bestIdx = 0
  let bestDist = Infinity
  itemEls.value.forEach((el, i) => {
    if (!el) return
    const c = el.offsetLeft + el.offsetWidth / 2
    const d = Math.abs(c - center)
    if (d < bestDist) { bestDist = d; bestIdx = i }
  })
  activeIndex.value = bestIdx
}

watch(cardCount, (n) => {
  itemEls.value = itemEls.value.slice(0, n)
  nextTick(recalcActive)
})

onMounted(() => {
  nextTick(recalcActive)
})

function scrollToIndex(i: number) {
  const el = itemEls.value[i]
  if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
}
</script>

<template>
  <div class="party-stage">
    <div class="party-center" ref="scrollerRef" @scroll.passive="recalcActive">
      <article v-if="showEncounter" :ref="el => setItemRef(el as Element | null, 0)" class="sheet-column">
        <div class="sheet-tools">
          <IconButton :label="t('encounter.close')" @click.stop="encounter.togglePanel()">
            <IconClose :size="14" />
          </IconButton>
        </div>
        <div class="sheet-column-body">
          <EncounterPanel />
        </div>
      </article>
      <article
        v-for="(id, i) in ids"
        :key="id"
        :ref="el => setItemRef(el as Element | null, i + sheetOffset)"
        :class="['sheet-column', { 'is-active': selection?.kind === 'character' && selection.id === id }]"
        @mousedown="selectCharacter(id)"
      >
        <div class="sheet-tools">
          <SheetActions :character-id="id" />
          <IconButton :label="t('gameLayout.sheetColumn.close')" @click.stop="closePanel(id)">
            <IconClose :size="14" />
          </IconButton>
        </div>
        <div class="sheet-column-body">
          <InGameView :id="id" />
        </div>
      </article>
    </div>

    <div v-if="cardCount > 1" class="party-dots">
      <button
        v-for="(_, i) in cardCount"
        :key="i"
        type="button"
        class="party-dot"
        :class="{ 'is-active': i === activeIndex }"
        :aria-label="t('gameLayout.sheetColumn.goToCard', { n: i + 1 })"
        @click="scrollToIndex(i)"
      />
    </div>
  </div>
</template>

<style scoped>
.party-stage {
  position: relative;
  height: 100%;
}
.party-center {
  display: flex;
  align-items: stretch;
  justify-content: safe center;
  gap: var(--s-4);
  padding: var(--s-4) 0;
  height: 100%;
  scroll-snap-type: x proximity;
  /* The scroller runs under the side panels; snap positions must start beside them, not under them. */
  scroll-padding-inline: calc(var(--gl-left-w) + var(--s-4)) calc(var(--gl-right-w) + var(--s-4));
  overflow-x: auto;
  overflow-y: hidden;
}
.party-dots { display: none; }
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
  background: linear-gradient(to bottom, var(--vtt-elevated-a78), var(--vtt-surface-a82));
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
  backdrop-filter: blur(14px) saturate(1.2);
  border-radius: var(--r-lg);
  box-shadow: 0 8px 28px var(--vtt-black-a55), 0 0 0 1px var(--vtt-gold-a20);
  overflow: hidden;
  scroll-snap-align: start;
  position: relative;
}
.sheet-column.is-active {
  box-shadow:
    0 8px 28px var(--vtt-black-a55),
    0 0 0 1px var(--vtt-border-gold),
    0 0 24px var(--vtt-accent-a10);
}

.sheet-tools {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 10;
  display: flex;
  gap: 6px;
}
/* StatusHeader keeps its name line clear of the close button; the actions button needs room too. */
.sheet-column:has(.sheet-tools [aria-haspopup='menu']) :deep(.sh-id) { padding-right: 68px; }
.sheet-column:has(.sheet-tools [aria-haspopup='menu']) :deep(.status-header.is-compact .sh-id) { padding-right: 0; }

.sheet-column-body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.sheet-column-body :deep(.app-shell) {
  flex: 1 1 auto;
  background: transparent;
}

@media (max-width: 960px) {
  .party-center {
    gap: 0;
    padding: 10px 0 20px;
    scroll-snap-type: x mandatory;
    scroll-padding-inline: 0;
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
  .party-dots {
    display: flex;
    position: absolute;
    bottom: 8px;
    left: 0;
    right: 0;
    justify-content: center;
    align-items: center;
    gap: 6px;
    pointer-events: none;
    z-index: 5;
  }
  .party-dot {
    pointer-events: auto;
    width: 6px;
    height: 6px;
    padding: 0;
    background: var(--vtt-text-muted);
    border: none;
    border-radius: 50%;
    opacity: 0.4;
    cursor: pointer;
    transition: width var(--t-fast) var(--ease), background var(--t-fast) var(--ease), opacity var(--t-fast) var(--ease);
  }
  .party-dot.is-active {
    width: 18px;
    background: var(--vtt-accent);
    opacity: 1;
    border-radius: var(--r-pill);
  }
}
</style>
