<script setup lang="ts">
import IconCheck from '@/components/ui/icons/IconCheck.vue'

const props = withDefaults(defineProps<{
  /** Number of steps. */
  count: number
  /** The current step, from 1. */
  current: number
  /** Dots are buttons, and a finished step can be selected to go back to it; otherwise they are static. */
  navigable?: boolean
}>(), {
  navigable: false,
})

const emit = defineEmits<{ (e: 'select', step: number): void }>()

function state(n: number) {
  if (n < props.current) return 'is-done'
  if (n === props.current) return 'is-active'
  return ''
}

function onSelect(n: number) {
  if (n < props.current) emit('select', n)
}
</script>

<template>
  <div class="wz-steps">
    <span class="wz-steps-line" />
    <div class="wz-steps-dots">
      <template v-if="navigable">
        <button
          v-for="n in count"
          :key="n"
          type="button"
          :class="['wz-dot', 'wz-dot--button', state(n)]"
          :disabled="n > current"
          :aria-label="n < current ? String(n) : undefined"
          :aria-current="n === current ? 'step' : undefined"
          @click="onSelect(n)"
        >
          <IconCheck v-if="n < current" />
          <span v-else>{{ n }}</span>
        </button>
      </template>
      <template v-else>
        <span
          v-for="n in count"
          :key="n"
          :class="['wz-dot', state(n)]"
          :aria-current="n === current ? 'step' : undefined"
        >
          <IconCheck v-if="n < current" />
          <span v-else>{{ n }}</span>
        </span>
      </template>
    </div>
    <span class="wz-steps-line" />
  </div>
</template>

<style scoped>
.wz-steps {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-3) var(--s-5);
}
.wz-steps-line {
  height: 1px;
  background: linear-gradient(to right, transparent, var(--vtt-gold-a40), transparent);
}
.wz-steps-dots {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}
.wz-dot {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--r-pill);
  background: var(--vtt-elevated-a55);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--vtt-text-muted);
  border: 1px solid var(--vtt-gold-a25);
  position: relative;
}
.wz-dot--button {
  padding: 0;
  cursor: pointer;
  transition: all var(--t-fast) var(--ease);
}
.wz-dot--button:disabled { cursor: default; }
.wz-dot.is-done {
  color: var(--vtt-accent-soft);
  background: var(--vtt-gold-a25);
  border-color: var(--vtt-gold-a50);
}
.wz-dot--button.is-done:hover {
  background: var(--vtt-gold-a40);
  border-color: var(--vtt-border-gold);
}
.wz-dot.is-active {
  color: var(--vtt-bg-base);
  background: linear-gradient(to bottom, var(--vtt-accent), var(--vtt-accent-deep));
  border-color: var(--vtt-border-gold);
  box-shadow: 0 0 14px var(--vtt-accent-a35);
}
.wz-dot + .wz-dot::before {
  content: "";
  position: absolute;
  left: -8px;
  top: 50%;
  transform: translateY(-50%);
  width: 6px;
  height: 1px;
  background: var(--vtt-gold-a35);
}
.wz-dot svg { width: 12px; height: 12px; }
</style>
