<script setup lang="ts">
import { computed, useId } from 'vue'
import Button from '@/components/ui/Button.vue'
import HpBar from '@/components/ui/HpBar.vue'
import IconButton from '@/components/ui/IconButton.vue'
import IconChevronRight from '@/components/ui/icons/IconChevronRight.vue'
import IconEdit from '@/components/ui/icons/IconEdit.vue'
import IconGrip from '@/components/ui/icons/IconGrip.vue'
import IconMinus from '@/components/ui/icons/IconMinus.vue'
import IconPlus from '@/components/ui/icons/IconPlus.vue'
import IconReroll from '@/components/ui/icons/IconReroll.vue'
import IconSkull from '@/components/ui/icons/IconSkull.vue'
import IconSwords from '@/components/ui/icons/IconSwords.vue'
import IconTrash from '@/components/ui/icons/IconTrash.vue'
import Pill from '@/components/ui/Pill.vue'
import SectionLabel from '@/components/ui/SectionLabel.vue'
import ItemStatChip from '@/features/in-game/components/inventory/ItemStatChip.vue'
import ConditionPicker from './ConditionPicker.vue'
import { monsterLabel } from '@/domain/encounter'
import { conditionName } from '@/locales/content'
import type { ConditionId, EncounterMonster, SortMode } from '@/types/encounter'
import { t } from '@/locales'

const props = defineProps<{
  monster: EncounterMonster
  selected: boolean
  sortMode: SortMode
}>()
const emit = defineEmits<{
  (e: 'select'): void
  (e: 'attack'): void
  (e: 'kill-or-revive'): void
  (e: 'change-hp', delta: number): void
  (e: 'toggle-condition', id: ConditionId): void
  (e: 'edit'): void
  (e: 'remove'): void
  (e: 'move', direction: -1 | 1): void
}>()
const expanded = defineModel<boolean>('expanded', { default: false })

const uid = useId()
const dead = computed(() => props.monster.diedAt !== undefined)
const label = computed(() => monsterLabel(props.monster))

function onGripKeydown(e: KeyboardEvent) {
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
  e.preventDefault()
  emit('move', e.key === 'ArrowUp' ? -1 : 1)
}

// A click on empty space in the head selects too; the buttons inside act on their own.
function onHeadClick(e: MouseEvent) {
  if ((e.target as Element).closest('button')) return
  if (!dead.value) emit('select')
}
</script>

<template>
  <article
    :aria-label="label"
    :class="['ec-card', { 'is-selected': selected, 'is-dead': dead }]"
  >
    <div class="ec-top" @click="onHeadClick">
      <button
        v-if="sortMode === 'manual' && !dead"
        type="button"
        class="ec-grip"
        :aria-label="t('encounter.card.grip')"
        @click.stop
        @keydown="onGripKeydown"
      >
        <IconGrip :size="14" />
      </button>
      <button
        type="button"
        class="ec-title"
        :disabled="dead"
        :aria-pressed="selected"
        @click="emit('select')"
      >
        <span class="ec-name">{{ monster.name }}</span>
        <span class="ec-num">#{{ monster.n }}</span>
      </button>
      <div class="ec-btns">
        <IconButton size="md" variant="square" :label="t('encounter.card.attack')" :disabled="dead" @click="emit('attack')">
          <IconSwords :size="14" />
        </IconButton>
        <IconButton
          size="md"
          variant="square"
          :label="dead ? t('encounter.card.revive') : t('encounter.card.kill')"
          @click="emit('kill-or-revive')"
        >
          <IconReroll v-if="dead" :size="14" />
          <IconSkull v-else :size="14" />
        </IconButton>
        <IconButton
          size="md"
          variant="square"
          :label="expanded ? t('encounter.card.collapse') : t('encounter.card.expand')"
          :expanded="expanded"
          :aria-controls="`${uid}-details`"
          @click="expanded = !expanded"
        >
          <IconChevronRight :size="12" :class="['ec-chevron', { 'is-open': expanded }]" />
        </IconButton>
      </div>
    </div>

    <div class="ec-mid">
      <div class="ec-hp">
        <IconButton size="sm" variant="square" :label="t('encounter.card.hpDown')" @click="emit('change-hp', -1)">
          <IconMinus :size="12" />
        </IconButton>
        <div class="ec-bar"><HpBar :current="monster.hp" :max="monster.maxHp" size="sm" :show-controls="false" /></div>
        <IconButton size="sm" variant="square" :label="t('encounter.card.hpUp')" @click="emit('change-hp', 1)">
          <IconPlus :size="12" />
        </IconButton>
      </div>
      <div class="ec-chips">
        <ItemStatChip variant="armor">{{ t('encounter.card.armor', { armor: monster.armor }) }}</ItemStatChip>
        <ItemStatChip variant="damage">{{ monster.damage }}</ItemStatChip>
      </div>
    </div>

    <div v-if="monster.conditions.length && !expanded" class="ec-tags">
      <Pill v-for="id in monster.conditions" :key="id" size="sm">{{ conditionName(id) }}</Pill>
    </div>

    <div v-if="expanded" :id="`${uid}-details`" class="ec-open">
      <div v-if="monster.special" class="ec-text">
        <SectionLabel tone="neutral">{{ t('encounter.card.special') }}</SectionLabel>
        <p>{{ monster.special }}</p>
      </div>
      <div v-if="monster.notes" class="ec-text">
        <SectionLabel tone="neutral">{{ t('encounter.card.notes') }}</SectionLabel>
        <p>{{ monster.notes }}</p>
      </div>
      <ConditionPicker :conditions="monster.conditions" @toggle="id => emit('toggle-condition', id)" />
      <div class="ec-acts">
        <Button variant="ghost" size="sm" :icon-left="IconEdit" @click="emit('edit')">{{ t('encounter.card.edit') }}</Button>
        <Button variant="danger-ghost" size="sm" :icon-left="IconTrash" class="ec-remove" @click="emit('remove')">
          {{ t('encounter.card.remove') }}
        </Button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.ec-card {
  border-radius: var(--r-md);
  background: var(--vtt-elevated-a72);
  box-shadow: inset 0 0 0 1px var(--vtt-border-strong);
  transition: box-shadow var(--t-fast) var(--ease), opacity var(--t-med) var(--ease);
}
.ec-card.is-selected {
  background: var(--vtt-elevated-a96);
  box-shadow: inset 0 0 0 1px var(--vtt-accent), 0 0 16px var(--vtt-accent-a35);
}
.ec-card.is-drag-ghost { opacity: 0.35; }
.ec-card.sortable-fallback { box-shadow: var(--shadow-2), inset 0 0 0 1px var(--vtt-accent); }
.ec-card.is-dead { opacity: 0.55; background: var(--vtt-surface-a70); }
.ec-card.is-dead .ec-name {
  text-decoration: line-through;
  text-decoration-color: var(--vtt-border-strong);
}

.ec-top {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px 6px;
  cursor: pointer;
}
.ec-card.is-dead .ec-top { cursor: default; }
.ec-grip {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 32px;
  margin: -4px 0 -4px -6px;
  padding: 0;
  border: 0;
  border-radius: var(--r-xs);
  background: transparent;
  color: var(--vtt-text-muted);
  cursor: grab;
  /* A drag from the grip must not scroll the list. */
  touch-action: none;
}
.ec-grip:hover { color: var(--vtt-accent-soft); }

/* The number sits outside the truncating name, so a long name never pushes it out. */
.ec-title {
  display: flex;
  align-items: baseline;
  flex: 1 1 auto;
  min-width: 0;
  gap: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--vtt-text-primary);
  text-align: left;
  cursor: inherit;
}
.ec-title:disabled { color: inherit; }
.ec-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-serif);
  font-size: 16px;
  font-weight: 500;
}
.ec-num {
  flex: none;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--vtt-accent-deep);
}
.ec-btns { display: flex; flex: none; gap: 4px; }
.ec-chevron { transition: transform var(--t-fast) var(--ease); transform: rotate(90deg); }
.ec-chevron.is-open { transform: rotate(-90deg); }

.ec-mid {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  padding: 0 10px 9px;
}
.ec-hp { display: flex; flex: 1 1 200px; align-items: center; gap: 8px; min-width: 0; }
.ec-bar { flex: 1 1 auto; min-width: 0; }
.ec-bar :deep(.hp-bar) { min-width: 0; }
.ec-chips { display: flex; flex: none; gap: 6px; }

.ec-tags { display: flex; flex-wrap: wrap; gap: 4px; padding: 0 10px 8px; }

.ec-open {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  border-top: 1px solid var(--vtt-border-subtle);
}
.ec-text { display: flex; flex-direction: column; gap: 3px; }
.ec-text p {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 14px;
  line-height: 1.35;
  color: var(--vtt-text-secondary);
  overflow-wrap: anywhere;
}
.ec-acts { display: flex; gap: 6px; }
.ec-remove { margin-left: auto; }
</style>
