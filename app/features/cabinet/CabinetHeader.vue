<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { currentUser } from '@/transport/auth'
import { t } from '@/locales'

// RouterLink marks the page that is open with aria-current="page"; the styles key off that.
const initial = computed(() => {
  const user = currentUser.value
  return (user?.name.trim().charAt(0) || user?.email.charAt(0) || '?').toUpperCase()
})
</script>

<template>
  <header class="ch">
    <div class="ch-inner">
      <span class="ch-brand">World of Dungeons</span>

      <nav class="ch-nav" :aria-label="t('nav.cabinet')">
        <RouterLink :to="{ name: 'games' }" class="ch-link">{{ t('nav.games') }}</RouterLink>
        <RouterLink :to="{ name: 'characters' }" class="ch-link">{{ t('nav.characters') }}</RouterLink>
      </nav>

      <!-- Apart from the cabinet links: a different place, whose characters live on this device. -->
      <RouterLink :to="{ name: 'offline' }" class="ch-offline">
        {{ t('nav.offlineTable') }}<span class="ch-offline-mark" aria-hidden="true">↗</span>
      </RouterLink>

      <RouterLink :to="{ name: 'profile' }" class="ch-avatar" :aria-label="t('nav.profile')">
        {{ initial }}
      </RouterLink>
    </div>
  </header>
</template>

<style scoped>
.ch {
  position: sticky;
  top: 0;
  z-index: 20;
  background: rgba(14, 11, 8, 0.88);
  border-bottom: 1px solid var(--vtt-border-subtle);
  -webkit-backdrop-filter: blur(14px) saturate(1.15);
  backdrop-filter: blur(14px) saturate(1.15);
}
.ch-inner {
  max-width: 960px;
  margin: 0 auto;
  padding: var(--s-2) var(--s-4) 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  grid-template-areas: "brand nav offline avatar";
  align-items: center;
  column-gap: var(--s-5);
}

.ch-brand {
  grid-area: brand;
  padding-bottom: var(--s-2);
  font-family: var(--font-serif);
  font-size: 17px;
  font-weight: 500;
  color: var(--vtt-accent-soft);
  white-space: nowrap;
}

.ch-nav {
  grid-area: nav;
  display: flex;
  gap: 2px;
  min-width: 0;
}
.ch-link {
  position: relative;
  padding: 10px 14px 12px;
  border-radius: var(--r-xs) var(--r-xs) 0 0;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: var(--vtt-text-muted);
  text-decoration: none;
  white-space: nowrap;
  transition: color var(--t-fast) var(--ease), background var(--t-fast) var(--ease);
}
.ch-link:hover { color: var(--vtt-text-secondary); background: rgba(228, 201, 160, 0.03); }
.ch-link:focus-visible { outline: 1px solid var(--vtt-border-gold); outline-offset: -2px; }
.ch-link[aria-current='page'] { color: var(--vtt-accent-soft); background: var(--vtt-bg-elevated); }
.ch-link[aria-current='page']::after {
  content: "";
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: -1px;
  height: 2px;
  background: linear-gradient(to right, var(--vtt-accent-deep), var(--vtt-accent));
  border-radius: 2px 2px 0 0;
}

.ch-offline {
  grid-area: offline;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  margin-bottom: var(--s-2);
  border: 1px solid var(--vtt-border-strong);
  border-radius: var(--r-pill);
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--vtt-text-secondary);
  text-decoration: none;
  white-space: nowrap;
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
}
.ch-offline:hover { color: var(--vtt-accent-soft); border-color: var(--vtt-border-gold); }
.ch-offline:focus-visible { outline: 1px solid var(--vtt-border-gold); outline-offset: 2px; }
.ch-offline-mark { color: var(--vtt-text-muted); }

.ch-avatar {
  grid-area: avatar;
  width: 34px;
  height: 34px;
  margin-bottom: var(--s-2);
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(58, 45, 33, 0.9) 0%, rgba(26, 21, 16, 0.9) 100%);
  box-shadow: inset 0 0 0 1px rgba(228, 201, 160, 0.12);
  font-family: var(--font-serif);
  font-size: 15px;
  font-weight: 500;
  line-height: 1;
  color: var(--vtt-accent-soft);
  text-decoration: none;
  transition: box-shadow var(--t-fast) var(--ease);
}
.ch-avatar:hover { box-shadow: inset 0 0 0 1px rgba(228, 201, 160, 0.28); }
.ch-avatar:focus-visible { outline: 1px solid var(--vtt-border-gold); outline-offset: 2px; }
.ch-avatar[aria-current='page'] {
  background: linear-gradient(135deg, rgba(140, 106, 58, 0.55) 0%, rgba(74, 58, 40, 0.75) 100%);
  box-shadow: inset 0 0 0 1px rgba(228, 201, 160, 0.45), 0 0 10px rgba(212, 168, 87, 0.35);
  color: var(--vtt-accent);
}

/* Phone: the brand and the avatar on top, the links in a second row. */
@media (max-width: 719px) {
  .ch-inner {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      "brand avatar"
      "nav offline";
    column-gap: var(--s-3);
    padding-top: var(--s-3);
  }
  .ch-brand { padding-bottom: 0; }
  .ch-avatar { margin-bottom: 0; justify-self: end; }
  .ch-nav { margin-top: var(--s-2); margin-left: -10px; }
  .ch-link { padding: 10px 10px 12px; }
  .ch-offline { justify-self: end; margin: var(--s-2) 0 var(--s-2); }
}
</style>
