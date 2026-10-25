<script setup lang="ts">
import { ref, watch } from 'vue'
import IconCoin from '@/components/ui/icons/IconCoin.vue'
import IconPlus from '@/components/ui/icons/IconPlus.vue'
import IconMinus from '@/components/ui/icons/IconMinus.vue'
import { t } from '@/locales'

const props = defineProps<{ coins: number }>()
const emit = defineEmits<{ (e: 'update', value: number): void }>()

const editing = ref(false)
const draft = ref(props.coins)

watch(() => props.coins, v => { if (!editing.value) draft.value = v })

function startEdit() {
  draft.value = props.coins
  editing.value = true
}
function commit() {
  const v = Math.max(0, Math.floor(Number(draft.value) || 0))
  emit('update', v)
  editing.value = false
}
function cancel() {
  draft.value = props.coins
  editing.value = false
}
function bump(delta: number) {
  emit('update', Math.max(0, props.coins + delta))
}
</script>

<template>
  <div class="coin-bar">
    <div class="coin-bar-icon"><IconCoin /></div>
    <span class="coin-bar-label">{{ t('inGame.inventory.coinsLabel') }}</span>
    <input
      v-if="editing"
      class="coin-bar-input"
      type="number"
      min="0"
      v-model.number="draft"
      @blur="commit"
      @keydown.enter.prevent="commit"
      @keydown.escape="cancel"
      autofocus
    />
    <span v-else class="coin-bar-value" @click="startEdit" role="button" tabindex="0" @keydown.enter="startEdit">
      {{ coins }}<span class="coin-bar-unit">{{ t('inGame.inventory.coinsUnit') }}</span>
    </span>
    <div class="coin-bar-actions">
      <button class="item-btn" type="button" :aria-label="t('inGame.inventory.coinsMinus')" @click="bump(-1)">
        <IconMinus />
      </button>
      <button class="item-btn" type="button" :aria-label="t('inGame.inventory.coinsPlus')" @click="bump(1)">
        <IconPlus />
      </button>
    </div>
  </div>
</template>

<style scoped>
.coin-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--vtt-bg-surface);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-sm);
}
.coin-bar-icon {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--vtt-accent);
  flex-shrink: 0;
}
.coin-bar-icon :deep(svg) { width: 100%; height: 100%; }
.coin-bar-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
}
.coin-bar-value {
  font-family: var(--font-serif);
  font-size: 22px;
  color: var(--vtt-accent-soft);
  line-height: 1;
  margin-left: auto;
  cursor: pointer;
}
.coin-bar-unit {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  color: var(--vtt-text-muted);
  margin-left: 4px;
}
.coin-bar-input {
  margin-left: auto;
  width: 96px;
  padding: 4px 8px;
  background: var(--vtt-bg-sunken);
  border: 1px solid var(--vtt-border-gold);
  border-radius: var(--r-xs);
  color: var(--vtt-accent-soft);
  font-family: var(--font-serif);
  font-size: 18px;
  text-align: right;
  outline: none;
  -moz-appearance: textfield;
}
.coin-bar-input::-webkit-outer-spin-button,
.coin-bar-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.coin-bar-actions {
  display: flex;
  gap: 4px;
}
.item-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-sm);
  color: var(--vtt-text-muted);
  cursor: pointer;
  transition: all var(--t-fast) var(--ease);
  padding: 0;
}
.item-btn :deep(svg) { width: 14px; height: 14px; }
.item-btn:hover {
  border-color: var(--vtt-border-strong);
  color: var(--vtt-accent-soft);
  background: var(--vtt-bg-elevated);
}
</style>
