<script setup lang="ts">
import { computed } from 'vue'
import type { Character } from '@/types/character'
import { xpThreshold } from '@/utils/character'

const props = defineProps<{ char: Character }>()
const emit = defineEmits<{ patch: [data: Partial<Character>] }>()

const hpPercent = computed(() =>
  Math.max(0, Math.min(100, (props.char.currentHp / props.char.maxHp) * 100))
)

const threshold = computed(() => xpThreshold(props.char.level))

function changeHp(delta: number) {
  const newHp = Math.max(0, Math.min(props.char.maxHp, props.char.currentHp + delta))
  emit('patch', { currentHp: newHp })
}

function toggleXp(idx: number) {
  // Кружки 0..threshold-1: клик на idx → xp = idx+1 если не отмечен, idx если отмечен
  const newXp = props.char.xp === idx + 1 ? idx : idx + 1
  emit('patch', { xp: Math.min(newXp, threshold.value) })
}
</script>

<template>
  <div class="block">
    <!-- HP -->
    <div class="hp-section">
      <div class="label" style="margin-bottom: 6px">Хиты</div>
      <div class="hp-row">
        <button class="hp-btn" @click="changeHp(-1)">−</button>
        <div class="hp-numbers">
          <span class="hp-current">{{ char.currentHp }}</span>
          <span class="hp-sep">/</span>
          <span class="hp-max">{{ char.maxHp }}</span>
        </div>
        <button class="hp-btn" @click="changeHp(+1)">+</button>
      </div>
      <div class="hp-bar">
        <div class="hp-bar__fill" :style="{ width: hpPercent + '%' }" />
      </div>
    </div>

    <div class="divider-v" />

    <!-- XP -->
    <div class="xp-section">
      <div class="label" style="margin-bottom: 6px">Опыт ({{ char.xp }}/{{ threshold }})</div>
      <div class="xp-circles">
        <button
          v-for="i in threshold"
          :key="i"
          class="xp-circle"
          :class="{ 'xp-circle--filled': i <= char.xp }"
          @click="toggleXp(i - 1)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.block {
  display: flex;
  gap: 16px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
  align-items: flex-start;
}
.hp-section { flex: 1; }
.hp-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.hp-btn {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  color: var(--color-accent);
  width: 32px;
  height: 32px;
  border-radius: var(--border-radius);
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
}
.hp-numbers { display: flex; align-items: baseline; gap: 4px; }
.hp-current { font-size: 28px; font-weight: 700; }
.hp-sep { color: var(--color-text-muted); }
.hp-max { font-size: 16px; color: var(--color-text-muted); }
.hp-bar { height: 5px; background: var(--color-bg-elevated); border-radius: 2px; overflow: hidden; }
.hp-bar__fill { height: 100%; background: var(--color-accent); border-radius: 2px; transition: width 0.3s; }
.divider-v { width: 1px; background: var(--color-border); opacity: 0.3; align-self: stretch; }
.xp-section { flex: 1; }
.xp-circles { display: flex; flex-wrap: wrap; gap: 5px; }
.xp-circle {
  width: 14px;
  height: 14px;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  background: none;
  cursor: pointer;
}
.xp-circle--filled { background: var(--color-accent); border-color: var(--color-accent); }
</style>
