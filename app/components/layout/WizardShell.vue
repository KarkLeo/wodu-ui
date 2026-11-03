<script setup lang="ts">
import type { Component } from 'vue'
import { useIsMobile } from '@/composables/useIsMobile'
import Button from '@/components/ui/Button.vue'
import IconButton from '@/components/ui/IconButton.vue'
import IconClose from '@/components/ui/icons/IconClose.vue'

withDefaults(defineProps<{
  title: string
  /** Small mono line under the title; the `#subtitle` slot takes rich content instead. */
  subtitle?: string
  /** What the step still needs, or what it has chosen, in the middle of the top bar. */
  hint?: string
  closeLabel: string
  backLabel: string
  nextLabel: string
  /** Drawn before the next label in place of the forward arrow: the final action (create, confirm). */
  nextIcon?: Component
  nextDisabled?: boolean
}>(), {
  subtitle: undefined,
  hint: undefined,
  nextIcon: undefined,
  nextDisabled: false,
})

defineEmits<{
  (e: 'close'): void
  (e: 'back'): void
  (e: 'next'): void
}>()

// On phones the wizard covers the whole screen, above the table's panels and bars.
const isMobile = useIsMobile()
</script>

<template>
  <Teleport to="body" :disabled="!isMobile">
    <div class="wz-shell">
      <div class="wz-topbar">
        <div class="wz-title">
          <span class="wz-title-text">{{ title }}</span>
          <span v-if="subtitle || $slots.subtitle" class="wz-subtitle"><slot name="subtitle">{{ subtitle }}</slot></span>
        </div>
        <div class="wz-hint">{{ hint }}</div>
        <IconButton size="lg" class="wz-close" :label="closeLabel" @click="$emit('close')">
          <IconClose />
        </IconButton>
      </div>

      <div v-if="$slots.stepper" class="wz-stepper">
        <slot name="stepper" />
      </div>

      <div class="wz-content">
        <slot />
      </div>

      <div class="wz-footer">
        <Button variant="ghost" @click="$emit('back')">← {{ backLabel }}</Button>
        <div class="wz-footer-spacer" />
        <Button variant="hero" :icon-left="nextIcon" :disabled="nextDisabled" @click="$emit('next')">
          <template v-if="nextIcon">{{ nextLabel }}</template>
          <template v-else>{{ nextLabel }} →</template>
        </Button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.wz-shell {
  display: grid;
  grid-template-rows: 52px auto minmax(0, 1fr) auto;
  grid-template-areas: "topbar" "stepper" "content" "footer";
  height: 100%;
  max-width: 720px;
  margin: 0 auto;
  overflow: hidden;
  background:
    linear-gradient(to bottom, rgba(26, 21, 16, 0.62), rgba(14, 11, 8, 0.7)),
    rgba(7, 5, 10, 0.35);
  -webkit-backdrop-filter: blur(22px) saturate(1.1);
  backdrop-filter: blur(22px) saturate(1.1);
  position: relative;
  color: var(--vtt-text-primary);
  /* Between the side panels the wizard can be narrower than the viewport; steps size to the wizard. */
  container-type: inline-size;
}
@media (max-width: 719px) {
  .wz-shell {
    position: fixed;
    inset: 0;
    height: 100dvh;
    max-width: none;
    margin: 0;
    z-index: 50;
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }
}
@media (min-width: 720px) {
  .wz-shell {
    /* Centred, but never under GameLayout's side panels: shrinks first, then shifts off-centre. */
    --wz-w: min(720px, 100% - var(--gl-inset-left, 0px) - var(--gl-inset-right, 0px));
    width: var(--wz-w);
    max-width: none;
    height: calc(100% - 80px);
    max-height: 880px;
    margin: 40px auto 40px
      clamp(var(--gl-inset-left, 0px), (100% - var(--wz-w)) / 2, 100% - var(--gl-inset-right, 0px) - var(--wz-w));
    border-radius: var(--r-lg);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(140, 106, 58, 0.18);
  }
}

.wz-topbar {
  grid-area: topbar;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--s-3);
  padding: 0 var(--s-4);
}
.wz-title {
  justify-self: start;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
  font-family: var(--font-serif);
  font-size: 17px;
  font-weight: 500;
  color: var(--vtt-accent-soft);
  line-height: 1;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
}
.wz-title-text,
.wz-subtitle {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wz-subtitle {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
  font-weight: normal;
  text-shadow: none;
}
.wz-hint {
  justify-self: center;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.wz-close { justify-self: end; }

.wz-stepper { grid-area: stepper; }

.wz-content {
  grid-area: content;
  min-height: 0;
  overflow-y: auto;
  padding: var(--s-4) var(--s-5) var(--s-5);
  display: flex;
  flex-direction: column;
  gap: var(--s-5);
}
.wz-content::-webkit-scrollbar { width: 4px; }
.wz-content::-webkit-scrollbar-thumb { background: rgba(140, 106, 58, 0.3); border-radius: var(--r-pill); }

.wz-footer {
  grid-area: footer;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-3) var(--s-4);
}
.wz-footer-spacer { min-width: 0; }
</style>
