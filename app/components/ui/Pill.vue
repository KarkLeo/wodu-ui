<script setup lang="ts">
withDefaults(defineProps<{
  /** `accent` marks what is yours or the leading one (the master, a free character, offline); `danger` a cost or a risk. */
  tone?: 'neutral' | 'accent' | 'danger'
  /** `md` 10px in rows and cards, `sm` 9px beside a caption. */
  size?: 'md' | 'sm'
  /** A small accent dot before the text, for a mode or a live state. */
  dot?: boolean
}>(), {
  tone: 'neutral',
  size: 'md',
  dot: false,
})
</script>

<template>
  <span :class="['pill', `is-${tone}`, `sz-${size}`]">
    <span v-if="dot" class="pill-dot" aria-hidden="true" />
    <span class="pill-text"><slot /></span>
  </span>
</template>

<style scoped>
.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  max-width: 100%;
  /* Filled, not outlined: an outlined capsule reads as a button. */
  border: 1px solid transparent;
  border-radius: var(--r-pill);
  background: var(--vtt-bg-elevated);
  background: color-mix(in srgb, var(--vtt-text-secondary) 12%, transparent);
  font-family: var(--font-mono);
  text-transform: uppercase;
  color: var(--vtt-text-secondary);
  white-space: nowrap;
}
.pill-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; }

.sz-md { padding: 2px 8px; font-size: 10px; letter-spacing: 0.12em; }
.sz-sm { padding: 1px 7px; font-size: 9px; letter-spacing: 0.14em; }

.is-accent {
  background: var(--vtt-bg-elevated);
  background: color-mix(in srgb, var(--vtt-accent-deep) 22%, transparent);
  color: var(--vtt-accent);
}
/* danger-bright on danger-soft is 4.36:1, under AA; the red stays in the fill. */
.is-danger { background: var(--vtt-danger-soft); color: var(--vtt-text-primary); }

.pill-dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: var(--r-pill);
  background: var(--vtt-accent);
}
</style>
