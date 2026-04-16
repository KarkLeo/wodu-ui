<script setup lang="ts">
import type { Character } from '@/types/character'

const props = defineProps<{ char: Character }>()
const emit = defineEmits<{ patch: [data: Partial<Character>] }>()

function updateBond(idx: number, value: string) {
  const bonds = [...props.char.bonds]
  bonds[idx] = value
  emit('patch', { bonds })
}
</script>

<template>
  <div class="tab-content">
    <div class="hint">Заполни связи с другими персонажами</div>
    <div v-for="(bond, idx) in char.bonds" :key="idx" class="bond-row">
      <textarea
        class="bond-input"
        :value="bond"
        rows="2"
        @input="updateBond(idx, ($event.target as HTMLTextAreaElement).value)"
      />
    </div>
  </div>
</template>

<style scoped>
.tab-content { padding: 16px; display: flex; flex-direction: column; gap: 12px; padding-bottom: 24px; }
.hint { font-size: 12px; color: var(--color-text-muted); }
.bond-row {}
.bond-input {
  width: 100%;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  font-family: inherit;
  font-feature-settings: "locl" 1;
  font-language-override: "BGR";
  font-size: 13px;
  padding: 10px 12px;
  border-radius: var(--border-radius);
  resize: none;
  line-height: 1.5;
}
.bond-input:focus { outline: none; border-color: var(--color-accent); }
</style>
