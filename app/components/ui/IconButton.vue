<script setup lang="ts">
type Size = 'lg' | 'md' | 'sm'
type Variant = 'round' | 'square'
type Tone = 'neutral' | 'accent' | 'danger'

const props = withDefaults(defineProps<{
  /** Accessible name; the button has no visible text. */
  label: string
  size?: Size
  variant?: Variant
  tone?: Tone
  pressed?: boolean
  expanded?: boolean
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}>(), {
  size: 'md',
  variant: 'round',
  tone: 'neutral',
  // Left out unless set, so a plain button carries no aria-pressed / aria-expanded.
  pressed: undefined,
  expanded: undefined,
  type: 'button',
})

defineEmits<{ (e: 'click', ev: MouseEvent): void }>()
</script>

<template>
  <button
    :class="['icon-btn', `v-${props.variant}`, `sz-${props.size}`, `t-${props.tone}`]"
    :type="props.type"
    :disabled="props.disabled"
    :aria-label="props.label"
    :aria-pressed="props.pressed"
    :aria-expanded="props.expanded"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>

<style scoped>
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
  background: transparent;
  border: 1px solid var(--vtt-border-subtle);
  color: var(--vtt-text-secondary);
  cursor: pointer;
  transition:
    background var(--t-fast) var(--ease),
    border-color var(--t-fast) var(--ease),
    color var(--t-fast) var(--ease);
}
.icon-btn :deep(svg) { display: block; flex-shrink: 0; }
.icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.sz-lg { width: 34px; height: 34px; }
.sz-md { width: 28px; height: 28px; }
.sz-sm { width: 22px; height: 22px; }

.v-round { border-radius: var(--r-pill); }
/* Row actions sit in dense lists, so they rest quieter than the round chrome buttons. */
.v-square {
  border-radius: var(--r-xs);
  color: var(--vtt-text-muted);
}

.icon-btn:hover:not(:disabled),
.icon-btn[data-state='open'],
.icon-btn[aria-expanded='true'] {
  border-color: var(--vtt-border-strong);
  color: var(--vtt-accent-soft);
}
.v-square:hover:not(:disabled) { background: var(--vtt-bg-elevated); }

/* Each tint is preceded by a plain token for browsers without color-mix() (iOS Safari before 16.2). */
.icon-btn.t-accent,
.icon-btn[aria-pressed='true'],
.icon-btn.t-accent:hover:not(:disabled),
.icon-btn[aria-pressed='true']:hover:not(:disabled) {
  border-color: var(--vtt-border-gold);
  color: var(--vtt-accent);
  background: var(--vtt-bg-elevated);
  background: color-mix(in srgb, var(--vtt-border-gold) 10%, transparent);
}

.icon-btn.t-danger:hover:not(:disabled) {
  border-color: var(--vtt-danger-bright);
  color: var(--vtt-danger-bright);
  background: var(--vtt-danger-soft);
  background: color-mix(in srgb, var(--vtt-danger-bright) 8%, transparent);
}
</style>
