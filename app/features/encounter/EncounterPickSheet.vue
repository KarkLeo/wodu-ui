<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import Button from '@/components/ui/Button.vue'
import Pill from '@/components/ui/Pill.vue'
import SearchField from '@/components/ui/SearchField.vue'
import SectionHeader from '@/components/ui/SectionHeader.vue'
import StateNote from '@/components/ui/StateNote.vue'
import ItemStatChip from '@/features/in-game/components/inventory/ItemStatChip.vue'
import { useEncounterAdd } from '@/composables/useEncounterAdd'
import { searchMonsters } from '@/domain/library'
import { starterMonsters } from '@/domain/starterLibrary'
import { useLibraryStore } from '@/stores/library'
import { loadMonsters } from '@/transport/library'
import type { LibraryMonster } from '@/types/library'
import { t } from '@/locales'

const props = defineProps<{ gameId: string }>()
const open = defineModel<boolean>('open', { required: true })

const library = useLibraryStore()
const { add } = useEncounterAdd()

const query = ref('')
// Presses sent in this sitting, per library entry. Counted when pressed, not when the write lands.
const sent = ref<Record<string, number>>({})

// A master who never visited the library screen has nothing in the store yet.
function ensureLoaded() {
  if (library.gameId === props.gameId && (library.status.monsters === 'ready' || library.status.monsters === 'loading')) return
  void loadMonsters(props.gameId)
}
watch(open, (now) => {
  if (now) {
    sent.value = {}
    ensureLoaded()
  } else {
    query.value = ''
  }
}, { immediate: true })

const forThisGame = computed(() => library.gameId === props.gameId)
const hasList = computed(() => forThisGame.value && (library.status.monsters === 'ready' || library.monsters.length > 0))
const failed = computed(() => forThisGame.value && library.status.monsters === 'failed' && !hasList.value)
const loading = computed(() => !hasList.value && !failed.value)

const own = computed(() => searchMonsters(hasList.value ? library.monsters : [], query.value))
const starter = computed(() => searchMonsters(starterMonsters(), query.value))

function press(entry: LibraryMonster) {
  sent.value = { ...sent.value, [entry.id]: (sent.value[entry.id] ?? 0) + 1 }
  void add(props.gameId, entry)
}
</script>

<template>
  <BottomSheet v-model:open="open" :title="t('encounter.pick.title')" :max-width="420">
    <div class="ep-stack">
      <StateNote v-if="loading" compact role="status">{{ t('library.monsters.loading') }}</StateNote>

      <StateNote v-else-if="failed" compact role="alert">
        {{ t('library.monsters.loadFailed') }}
        <template #action>
          <Button variant="ghost" size="sm" @click="loadMonsters(gameId)">{{ t('library.monsters.retry') }}</Button>
        </template>
      </StateNote>

      <template v-else>
        <SearchField v-model="query" :label="t('library.monsters.search')" :placeholder="t('library.monsters.searchPlaceholder')" />

        <StateNote v-if="own.length === 0 && starter.length === 0" compact role="status">
          {{ t('library.monsters.noMatches', { query: query.trim() }) }}
        </StateNote>

        <section v-if="own.length > 0" class="ep-section">
          <SectionHeader as="h3" :title="t('library.monsters.own')" :count="own.length" />
          <ul class="ep-list" :aria-label="t('library.monsters.own')">
            <li v-for="m in own" :key="m.id" class="ep-row">
              <span class="ep-name">{{ m.name }}</span>
              <span class="ep-chips">
                <ItemStatChip variant="hp">{{ t('library.monsters.hp', { hp: m.hp }) }}</ItemStatChip>
                <ItemStatChip variant="damage">{{ m.damage }}</ItemStatChip>
              </span>
              <Pill v-if="sent[m.id]" tone="accent" role="status">{{ t('encounter.pick.count', { count: sent[m.id]! }) }}</Pill>
              <Button variant="primary" size="sm" @click="press(m)">{{ t('encounter.pick.add') }}</Button>
            </li>
          </ul>
        </section>

        <section v-if="starter.length > 0" class="ep-section">
          <SectionHeader as="h3" :title="t('library.monsters.starter.title')" :count="starter.length" />
          <ul class="ep-list" :aria-label="t('library.monsters.starter.title')">
            <li v-for="m in starter" :key="m.id" class="ep-row">
              <span class="ep-name">{{ m.name }}</span>
              <span class="ep-chips">
                <ItemStatChip variant="hp">{{ t('library.monsters.hp', { hp: m.hp }) }}</ItemStatChip>
                <ItemStatChip variant="damage">{{ m.damage }}</ItemStatChip>
              </span>
              <Pill v-if="sent[m.id]" tone="accent" role="status">{{ t('encounter.pick.count', { count: sent[m.id]! }) }}</Pill>
              <Button variant="primary" size="sm" @click="press(m)">{{ t('encounter.pick.add') }}</Button>
            </li>
          </ul>
        </section>
      </template>
    </div>
  </BottomSheet>
</template>

<style scoped>
.ep-stack { display: flex; flex-direction: column; gap: var(--s-3); }
.ep-section { display: flex; flex-direction: column; gap: 8px; }
.ep-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; }
.ep-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: 10px;
  padding: 8px 10px 8px 14px;
  background: var(--vtt-bg-surface);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-sm);
}
.ep-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-serif);
  font-size: 15px;
  color: var(--vtt-text-primary);
}
.ep-chips { display: inline-flex; gap: 4px; }
</style>
