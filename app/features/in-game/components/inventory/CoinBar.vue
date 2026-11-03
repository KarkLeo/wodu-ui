<script setup lang="ts">
import IconCoin from '@/components/ui/icons/IconCoin.vue'
import SectionLabel from '@/components/ui/SectionLabel.vue'
import Stepper from '@/components/ui/Stepper.vue'
import { t } from '@/locales'

const props = defineProps<{ coins: number }>()
const emit = defineEmits<{ (e: 'update', value: number): void }>()

function update(value: number) {
  const next = Math.max(0, Math.floor(value))
  if (next !== props.coins) emit('update', next)
}
</script>

<template>
  <div class="coin-bar">
    <div class="coin-bar-icon"><IconCoin /></div>
    <SectionLabel tone="neutral">{{ t('inGame.inventory.coinsLabel') }}</SectionLabel>
    <Stepper
      class="coin-bar-amount"
      variant="plain"
      :model-value="coins"
      :min="0"
      :aria-label="t('inGame.inventory.coinsLabel')"
      :decrease-label="t('inGame.inventory.coinsMinus')"
      :increase-label="t('inGame.inventory.coinsPlus')"
      lazy
      @update:model-value="update"
    >
      <template #suffix><span class="coin-bar-unit">{{ t('inGame.inventory.coinsUnit') }}</span></template>
    </Stepper>
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
.coin-bar-amount { margin-left: auto; }
.coin-bar-unit {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  color: var(--vtt-text-muted);
}
</style>
