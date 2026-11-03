<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'

const props = withDefaults(defineProps<{
  /** The initial is its first letter; an empty name shows "?". */
  name: string
  /** `lg` 40px in list rows, `md` 34px in a header, `sm` 30px on a narrow rail. */
  size?: 'lg' | 'md' | 'sm'
  /** The gold look of an open or current entry. */
  selected?: boolean
  /** Hover ring, and a glow while selected; on by default for a link or a button. */
  interactive?: boolean
  as?: string | Component
}>(), {
  size: 'lg',
  selected: false,
  interactive: undefined,
  as: 'span',
})

const initial = computed(() => props.name.trim().charAt(0).toUpperCase() || '?')
const isInteractive = computed(() => props.interactive ?? (typeof props.as !== 'string' || props.as === 'a' || props.as === 'button'))
</script>

<template>
  <component
    :is="as"
    :class="['avatar', `sz-${size}`, { 'is-selected': selected, 'is-interactive': isInteractive }]"
  ><span :aria-hidden="isInteractive ? undefined : 'true'">{{ initial }}</span><slot /></component>
</template>

<style scoped>
/* Each tint is preceded by a plain token for browsers without color-mix() (iOS Safari before 16.2). */
.avatar {
  position: relative;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--vtt-bg-surface);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--vtt-border-strong) 68%, var(--vtt-bg-sunken) 22%) 0%,
    color-mix(in srgb, var(--vtt-bg-surface) 90%, transparent) 100%
  );
  box-shadow: inset 0 0 0 1px var(--vtt-border-subtle);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--vtt-accent-soft) 12%, transparent);
  font-family: var(--font-serif);
  font-weight: 500;
  line-height: 1;
  color: var(--vtt-accent-soft);
  text-decoration: none;
}
.sz-lg { width: 40px; height: 40px; font-size: 17px; }
.sz-md { width: 34px; height: 34px; font-size: 15px; }
.sz-sm { width: 30px; height: 30px; font-size: 12px; }

.avatar.is-selected,
.avatar.is-interactive[aria-current='page'] {
  background: var(--vtt-bg-elevated);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--vtt-border-gold) 55%, transparent) 0%,
    color-mix(in srgb, var(--vtt-border-strong) 75%, transparent) 100%
  );
  box-shadow: inset 0 0 0 1px var(--vtt-border-strong);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--vtt-accent-soft) 28%, transparent);
  color: var(--vtt-accent);
}

.avatar.is-interactive {
  cursor: pointer;
  transition: background var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease);
}
.avatar.is-interactive:hover {
  box-shadow: inset 0 0 0 1px var(--vtt-border-strong);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--vtt-accent-soft) 28%, transparent);
}
.avatar.is-interactive.is-selected,
.avatar.is-interactive[aria-current='page'] {
  box-shadow: inset 0 0 0 1px var(--vtt-border-gold), 0 0 10px var(--vtt-border-gold);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--vtt-accent-soft) 45%, transparent),
    0 0 10px color-mix(in srgb, var(--vtt-accent) 35%, transparent);
}
</style>
