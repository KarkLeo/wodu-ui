<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  subtitle?: string
  /** `eyebrow`: a small mono caption over a list (the cabinet pages); `hero`: a large centred title (the sign-in screens). */
  variant?: 'default' | 'eyebrow' | 'hero'
}>(), {
  subtitle: undefined,
  variant: 'default',
})
</script>

<template>
  <header :class="['screen-header', `screen-header--${variant}`]">
    <div class="screen-header-titles">
      <h1 class="screen-header-title">{{ title }}</h1>
      <p v-if="subtitle" class="screen-header-subtitle">{{ subtitle }}</p>
    </div>
    <slot name="actions" />
  </header>
</template>

<style scoped>
.screen-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.screen-header-titles { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.screen-header-title {
  margin: 0;
  font-family: var(--font-serif);
  font-weight: 500;
  font-size: 22px;
  line-height: 1.2;
  color: var(--vtt-accent-soft);
}
.screen-header-subtitle {
  margin: 0;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 14px;
  color: var(--vtt-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Same look as the global `.eyebrow`. */
.screen-header--eyebrow .screen-header-title {
  padding-left: 4px;
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 11px;
  line-height: 1.5;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
}

.screen-header--hero { flex-direction: column; align-items: center; text-align: center; }
.screen-header--hero .screen-header-titles { gap: var(--s-1); }
.screen-header--hero .screen-header-title {
  font-size: 28px;
  line-height: 1.5;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
}
.screen-header--hero .screen-header-subtitle { font-size: 13px; white-space: normal; }
</style>
