<script setup lang="ts">
import bgUrl from '@/assets/bg.jpeg'
import ScreenHeader from '@/components/layout/ScreenHeader.vue'
import LocaleSwitch from '@/components/ui/LocaleSwitch.vue'
import { t, currentLocale } from '@/locales'
import { useAccount } from '@/composables/useAccount'

const { setLanguage } = useAccount()

defineProps<{
  title: string
  subtitle: string
  /** Without it the card has no heading (the landing). */
  cardTitle?: string
}>()
</script>

<template>
  <div class="as-shell" :style="{ '--as-bg': `url(${bgUrl})` }">
    <div class="as-column">
      <div class="as-top">
        <slot name="back" />
        <LocaleSwitch
          class="as-locale"
          :model-value="currentLocale"
          :aria-label="t('gameLayout.players.language')"
          @update:model-value="setLanguage"
        />
      </div>

      <ScreenHeader variant="hero" class="as-brand" :title="title" :subtitle="subtitle" />

      <slot name="banner" />

      <section class="as-card">
        <h2 v-if="cardTitle" class="as-card-title">{{ cardTitle }}</h2>
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
    linear-gradient(to bottom, var(--vtt-sunken-a55), var(--vtt-sunken-a35) 40%, var(--vtt-sunken-a72)),
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
.as-locale { margin-left: auto; }

.as-brand { margin: var(--s-7) 0 var(--s-6); }

.as-card {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
  padding: var(--s-5);
  border: 1px solid var(--vtt-border-gold);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-3);
  background: var(--vtt-surface-a96);
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
</style>
