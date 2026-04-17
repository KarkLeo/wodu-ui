<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Character, Move } from '@/types/character'
import fighter, { signatureWeaponOptions } from '@/data/classes/fighter'
import MoveDescription from '@/components/ui/MoveDescription.vue'

const props = defineProps<{ char: Character }>()

const charMoves = computed((): Move[] =>
  props.char.moveIds
    .map(id => fighter.moves.find(m => m.id === id))
    .filter((m): m is Move => m !== undefined)
)

const expanded = ref<string | null>(charMoves.value[0]?.id ?? null)
function toggle(id: string) {
  expanded.value = expanded.value === id ? null : id
}

function findName(list: { id: string; name: string }[], id: string) {
  return list.find(x => x.id === id)?.name ?? id
}
</script>

<template>
  <div class="tab-content">
    <div v-if="charMoves.length === 0" class="empty">Нет ходов</div>
    <div v-for="move in charMoves" :key="move.id" class="move-item">
      <button class="move-item__header" @click="toggle(move.id)">
        <span class="move-item__name">{{ move.name }}</span>
        <span class="move-item__chevron">{{ expanded === move.id ? '▲' : '▼' }}</span>
      </button>
      <div v-if="expanded === move.id" class="move-item__desc">
        <MoveDescription :move="move" />

        <!-- Параметры знакового оружия -->
        <div v-if="move.id === 'fighter_signature_weapon' && char.signatureWeapon" class="weapon-summary">
          <div class="weapon-summary__row">
            <span class="weapon-summary__tag">{{ findName(signatureWeaponOptions.bases, char.signatureWeapon.base) }}</span>
            <span class="weapon-summary__sep">·</span>
            <span class="weapon-summary__tag">{{ findName(signatureWeaponOptions.ranges, char.signatureWeapon.range) }}</span>
            <span class="weapon-summary__sep">·</span>
            <span class="weapon-summary__tag weapon-summary__tag--look">{{ findName(signatureWeaponOptions.appearances, char.signatureWeapon.appearance) }}</span>
          </div>
          <div class="weapon-summary__enhancements">
            <span
              v-for="eid in char.signatureWeapon.enhancements"
              :key="eid"
              class="weapon-summary__enh"
            >{{ findName(signatureWeaponOptions.enhancements, eid) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab-content { padding-bottom: 24px; }
.empty { padding: 24px 16px; text-align: center; color: var(--color-text-muted); font-size: 14px; }
.move-item { border-bottom: 1px solid var(--color-border); }
.move-item__header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: none;
  border: none;
  color: var(--color-text);
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
}
.move-item__header:hover { background: var(--color-bg-elevated); }
.move-item__chevron { font-size: 10px; color: var(--color-text-muted); flex-shrink: 0; }
.move-item__desc { padding: 0 16px 14px; font-size: 13px; color: var(--color-text-muted); line-height: 1.6; }

.weapon-summary {
  margin-top: 10px;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  background: var(--color-bg-elevated);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.weapon-summary__row { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
.weapon-summary__sep { color: var(--color-text-muted); }
.weapon-summary__tag {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text);
}
.weapon-summary__tag--look { font-style: italic; font-weight: 400; }
.weapon-summary__enhancements { display: flex; flex-wrap: wrap; gap: 4px; }
.weapon-summary__enh {
  font-size: 11px;
  padding: 2px 8px;
  border: 1px solid var(--color-accent);
  border-radius: 10px;
  color: var(--color-accent);
}
</style>
