<script setup lang="ts">
import bgUrl from '@/assets/bg.jpeg'
import { t, currentLocale, setLocale, LOCALES } from '@/locales'

defineProps<{
  title: string
  subtitle: string
  cardTitle: string
}>()
</script>

<template>
  <div class="as-shell" :style="{ '--as-bg': `url(${bgUrl})` }">
    <div class="as-column">
      <div class="as-top">
        <slot name="back" />
        <div class="as-locale" role="group" :aria-label="t('gameLayout.players.language')">
          <button
            v-for="l in LOCALES"
            :key="l"
            type="button"
            class="as-locale-btn"
            :class="{ 'is-active': currentLocale === l }"
            :aria-pressed="currentLocale === l"
            @click="setLocale(l)"
          >{{ l.toUpperCase() }}</button>
        </div>
      </div>

      <header class="as-brand">
        <h1 class="as-title">{{ title }}</h1>
        <p class="as-subtitle">{{ subtitle }}</p>
      </header>

      <section class="as-card">
        <h2 class="as-card-title">{{ cardTitle }}</h2>
        <slot />
      </section>

      <div class="as-footer">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.as-shell {
  min-height: 100dvh;
  display: flex;
  justify-content: center;
  color: var(--vtt-text-primary);
  background-image:
    linear-gradient(to bottom, rgba(7, 5, 10, 0.55), rgba(7, 5, 10, 0.35) 40%, rgba(7, 5, 10, 0.7)),
    var(--as-bg);
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
}
.as-column {
  width: 100%;
  max-width: 380px;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: var(--s-4) var(--s-4) var(--s-5);
}
.as-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-2);
  min-height: 24px;
}
.as-locale { display: flex; gap: 2px; margin-left: auto; }
.as-locale-btn {
  color: var(--vtt-text-muted);
  cursor: pointer;
  background: none;
  border: none;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
  line-height: 1.4;
}
.as-locale-btn.is-active { color: var(--vtt-text-primary); background: var(--vtt-bg-elevated); }

.as-brand { text-align: center; margin: var(--s-7) 0 var(--s-6); }
.as-title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 28px;
  font-weight: 500;
  color: var(--vtt-accent-soft);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
}
.as-subtitle {
  margin: var(--s-1) 0 0;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 13px;
  color: var(--vtt-text-muted);
}

.as-card {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
  padding: var(--s-5);
  border: 1px solid var(--vtt-border-gold);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-3);
  background: rgba(26, 21, 16, 0.96);
}
.as-card-title {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--vtt-accent-soft);
}

.as-footer {
  margin-top: auto;
  padding-top: var(--s-5);
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
}
.as-footer:empty { display: none; }
</style>

<!-- Shared by the step components that fill the slots. -->
<style>
.auth-wide { width: 100%; justify-content: center; }
.auth-error {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 13px;
  color: var(--vtt-danger-bright);
}
.auth-note {
  margin: 0;
  text-align: center;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 12px;
  color: var(--vtt-text-muted);
}
</style>
