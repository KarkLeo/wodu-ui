<script setup lang="ts">
import { computed } from 'vue'
import Button from '@/components/ui/Button.vue'
import IconWarning from '@/components/ui/icons/IconWarning.vue'
import { t } from '@/locales'

const props = defineProps<{
  count: number
  limit: number
  overdose: boolean
  canDrink: boolean
}>()

const emit = defineEmits<{
  (e: 'drink'): void
  (e: 'reset'): void
}>()

const over = computed(() => Math.max(0, props.count - props.limit))
const subtitle = computed(() => {
  if (props.overdose) return t('inGame.magic.quicksilver.overdoseAmount', { over: over.value })
  return t('inGame.magic.quicksilver.safe')
})
const title = computed(() =>
  props.overdose
    ? t('inGame.magic.quicksilver.titleOverdose')
    : t('inGame.magic.quicksilver.title'),
)
</script>

<template>
  <div :class="['qs-counter', { 'is-overdose': overdose }]">
    <div class="qs-dice">
      <div class="qs-dice-value">{{ count }}</div>
      <div class="qs-dice-limit">{{ t('inGame.magic.quicksilver.limitPrefix') }} <b>{{ limit }}</b></div>
    </div>
    <div class="qs-body">
      <div class="qs-title">{{ title }}</div>
      <div class="qs-subtitle">{{ subtitle }}</div>
      <div v-if="overdose" class="qs-warning">
        <IconWarning />
        <span>{{ t('inGame.magic.quicksilver.nextIsRoll') }}</span>
      </div>
    </div>
    <div class="qs-actions">
      <Button
        :variant="overdose ? 'hero-danger' : 'hero'"
        class="qs-drink"
        :disabled="!canDrink"
        :title="!canDrink ? t('inGame.magic.quicksilver.noMercury') : undefined"
        @click="emit('drink')"
      >
        {{ overdose ? t('inGame.magic.quicksilver.drinkAnyway') : t('inGame.magic.quicksilver.drink') }}
      </Button>
      <Button variant="ghost" @click="emit('reset')">
        {{ t('inGame.magic.quicksilver.newDay') }}
      </Button>
    </div>
  </div>
</template>

<style scoped>
.qs-counter {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 16px;
  align-items: center;
  padding: 14px 16px;
  background: var(--vtt-bg-surface);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-sm);
  transition: border-color var(--t-fast) var(--ease), background var(--t-fast) var(--ease);
}
.qs-counter.is-overdose {
  border-color: var(--vtt-danger);
  background: linear-gradient(to right, rgba(121, 43, 59, 0.14), var(--vtt-bg-surface) 60%);
}

.qs-dice {
  width: 62px;
  height: 62px;
  display: grid;
  grid-template-rows: auto 1fr;
  align-items: center;
  justify-content: center;
  border: 1.5px solid var(--vtt-border-gold);
  border-radius: var(--r-md);
  background: var(--vtt-bg-sunken);
  box-shadow: var(--shadow-inset);
  padding: 6px 0 8px;
  text-align: center;
  flex-shrink: 0;
}
.qs-counter.is-overdose .qs-dice {
  border-color: var(--vtt-danger-bright);
  animation: qs-pulse 2s ease-in-out infinite;
}
.qs-dice-value {
  font-family: var(--font-serif);
  font-size: 24px;
  color: var(--vtt-accent-soft);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.qs-counter.is-overdose .qs-dice-value { color: var(--vtt-danger-bright); }

.qs-dice-limit {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--vtt-text-muted);
  letter-spacing: 0.14em;
  margin-top: 2px;
}
.qs-dice-limit :deep(b) {
  color: var(--vtt-accent-soft);
  font-weight: 500;
}

.qs-body { min-width: 0; }
.qs-title {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
  margin-bottom: 3px;
}
.qs-subtitle {
  font-family: var(--font-serif);
  font-size: 14px;
  color: var(--vtt-text-secondary);
  font-style: italic;
  line-height: 1.35;
}
.qs-counter.is-overdose .qs-title { color: var(--vtt-danger-bright); }

.qs-warning {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12px;
  color: var(--vtt-danger-bright);
  margin-top: 4px;
  font-family: var(--font-sans);
}
.qs-warning :deep(svg) {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  margin-top: 2px;
}

.qs-actions {
  display: flex;
  gap: 8px;
  grid-column: 1 / -1;
  padding-top: 12px;
  border-top: 1px solid var(--vtt-border-subtle);
  margin-top: 4px;
}
.qs-drink { flex: 1; }
</style>
