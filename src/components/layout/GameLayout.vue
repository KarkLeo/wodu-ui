<script setup lang="ts">
import { ref, computed, provide, onMounted, onBeforeUnmount } from 'vue'
import IconMenu from '@/components/ui/icons/IconMenu.vue'
import IconDice from '@/components/ui/icons/IconDice.vue'
import IconClose from '@/components/ui/icons/IconClose.vue'
import { t } from '@/locales'
import bgUrl from '@/assets/bg.jpeg'
import { GameLayoutContextKey, type Side } from './gameLayoutContext'

const leftOpenMobile = ref(false)
const rightOpenMobile = ref(false)

const leftCollapsed = ref(false)
const rightCollapsed = ref(false)

function toggleCollapsed(side: Side) {
  if (side === 'left') leftCollapsed.value = !leftCollapsed.value
  else rightCollapsed.value = !rightCollapsed.value
}

provide(GameLayoutContextKey, {
  leftCollapsed,
  rightCollapsed,
  toggleCollapsed,
})

// Часы в топбаре: обновление раз в минуту.
const MONTHS_RU_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const now = ref(new Date())
let tickHandle: number | null = null
onMounted(() => {
  tickHandle = window.setInterval(() => { now.value = new Date() }, 60_000)
})
onBeforeUnmount(() => {
  if (tickHandle !== null) window.clearInterval(tickHandle)
})

const dateStr = computed(() => {
  const d = now.value
  return `${d.getDate()} ${MONTHS_RU_SHORT[d.getMonth()]}`
})
const timeStr = computed(() => {
  const d = now.value
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
})

function closeMobOverlays() {
  leftOpenMobile.value = false
  rightOpenMobile.value = false
}
</script>

<template>
  <div
    :class="['gl-shell', { 'is-left-collapsed': leftCollapsed, 'is-right-collapsed': rightCollapsed }]"
    :style="{ '--gl-bg': `url(${bgUrl})` }"
  >
    <!-- ── TOP BAR · DESKTOP ─────────────────────────────── -->
    <div class="gl-top">
      <div class="gl-top-title">
        <IconDice :size="16" />
        <span>{{ t('gameLayout.topTitle') }}</span>
      </div>
      <div class="gl-top-meta"><b>{{ dateStr }}</b> · {{ timeStr }}</div>
      <div class="gl-top-actions">
        <slot name="top-actions" />
      </div>
    </div>

    <!-- ── TOP BAR · MOBILE ──────────────────────────────── -->
    <div class="gl-mob-topbar">
      <button
        type="button"
        class="btn-icon-sm"
        :aria-label="t('gameLayout.actions.togglePlayers')"
        @click="leftOpenMobile = true"
      >
        <IconMenu :size="16" />
      </button>
      <div class="gl-mob-center-title">
        <span class="t"><b>{{ dateStr }}</b> · {{ timeStr }}</span>
        <span class="o">{{ t('gameLayout.topTitle') }}</span>
      </div>
      <button
        type="button"
        class="btn-icon-sm"
        :aria-label="t('gameLayout.actions.toggleDice')"
        @click="rightOpenMobile = true"
      >
        <IconDice :size="16" />
      </button>
    </div>

    <!-- ── LEFT PANEL · DESKTOP ──────────────────────────── -->
    <aside class="gl-left">
      <slot name="left" />
    </aside>

    <!-- ── CENTER ────────────────────────────────────────── -->
    <div class="gl-center">
      <slot />
    </div>

    <!-- ── RIGHT PANEL · DESKTOP ─────────────────────────── -->
    <aside class="gl-right">
      <slot name="right" />
    </aside>

    <!-- ── MOBILE OVERLAYS ──────────────────────────────── -->
    <div
      v-if="leftOpenMobile || rightOpenMobile"
      class="mob-overlay"
      @click="closeMobOverlays"
    />

    <aside v-if="leftOpenMobile" class="mob-side">
      <div class="mob-side-close">
        <button
          type="button"
          class="btn-icon-sm"
          :aria-label="t('gameLayout.actions.closePanel')"
          @click="leftOpenMobile = false"
        >
          <IconClose :size="14" />
        </button>
      </div>
      <div class="mob-side-body">
        <slot name="left" />
      </div>
    </aside>

    <aside v-if="rightOpenMobile" class="mob-sheet">
      <div class="mob-sheet-handle" />
      <div class="mob-sheet-head">
        <button
          type="button"
          class="btn-icon-sm"
          :aria-label="t('gameLayout.actions.closePanel')"
          @click="rightOpenMobile = false"
        >
          <IconClose :size="14" />
        </button>
      </div>
      <div class="mob-sheet-body">
        <slot name="right" />
      </div>
    </aside>
  </div>
</template>

<style scoped>
.gl-shell {
  --gl-left-w: 280px;
  --gl-right-w: 340px;
  --gl-top-h: 52px;

  position: relative;
  min-height: 100dvh;
  color: var(--vtt-text-primary);
  background-image:
    linear-gradient(to bottom, rgba(7, 5, 10, 0.35), rgba(7, 5, 10, 0.15) 40%, rgba(7, 5, 10, 0.55)),
    var(--gl-bg);
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
  overflow: hidden;
}
.gl-shell.is-left-collapsed  { --gl-left-w: 56px; }
.gl-shell.is-right-collapsed { --gl-right-w: 56px; }

/* ── DESKTOP TOP BAR ─────────────────────────────────── */
.gl-top {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: var(--gl-top-h);
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--s-4);
  padding: 0 var(--s-4);
  background: linear-gradient(to bottom, rgba(7, 5, 10, 0.72), rgba(7, 5, 10, 0));
  z-index: 3;
  pointer-events: none;
}
.gl-top > * { pointer-events: auto; }
.gl-top-title {
  font-family: var(--font-serif);
  font-size: 17px;
  font-weight: 500;
  color: var(--vtt-accent-soft);
  line-height: 1;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.gl-top-title :deep(svg) { color: var(--vtt-accent); flex-shrink: 0; }
.gl-top-meta {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--vtt-text-secondary);
  justify-self: center;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
}
.gl-top-actions {
  display: inline-flex;
  gap: var(--s-2);
  align-items: center;
}

/* ── MOBILE TOP BAR ──────────────────────────────────── */
.gl-mob-topbar {
  display: none;
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 44px;
  grid-template-columns: 36px 1fr 36px;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  background: var(--vtt-bg-elevated);
  border-bottom: 1px solid var(--vtt-border-subtle);
  z-index: 6;
}
.gl-mob-topbar .btn-icon-sm {
  width: 32px; height: 32px; border-radius: var(--r-pill);
}
.gl-mob-center-title {
  text-align: center;
  display: flex; flex-direction: column; gap: 1px; min-width: 0;
}
.gl-mob-center-title .t {
  font-family: var(--font-serif); font-size: 15px;
  color: var(--vtt-accent-soft); line-height: 1.1;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.gl-mob-center-title .o {
  font-family: var(--font-mono); font-size: 9px;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--vtt-text-muted);
}

/* ── LEFT PANEL ──────────────────────────────────────── */
.gl-left {
  position: absolute;
  top: var(--gl-top-h); left: 0; bottom: 0;
  width: var(--gl-left-w);
  display: flex; flex-direction: column;
  min-height: 0;
  z-index: 2;
  transition: width var(--t-med) var(--ease);
}
.gl-left::before {
  content: "";
  position: absolute; inset: 0;
  background: rgba(7, 5, 10, 0.78);
  backdrop-filter: blur(22px) saturate(1.1);
  -webkit-backdrop-filter: blur(22px) saturate(1.1);
  -webkit-mask-image: linear-gradient(to right,
    rgba(0, 0, 0, 1) 0%,
    rgba(0, 0, 0, 1) 55%,
    rgba(0, 0, 0, 0.6) 80%,
    rgba(0, 0, 0, 0) 100%);
  mask-image: linear-gradient(to right,
    rgba(0, 0, 0, 1) 0%,
    rgba(0, 0, 0, 1) 55%,
    rgba(0, 0, 0, 0.6) 80%,
    rgba(0, 0, 0, 0) 100%);
  z-index: -1;
  pointer-events: none;
}

/* ── RIGHT PANEL ─────────────────────────────────────── */
.gl-right {
  position: absolute;
  top: var(--gl-top-h); right: 0; bottom: 0;
  width: var(--gl-right-w);
  display: flex; flex-direction: column;
  min-height: 0;
  z-index: 2;
  transition: width var(--t-med) var(--ease);
}
.gl-right::before {
  content: "";
  position: absolute; inset: 0;
  background: rgba(7, 5, 10, 0.78);
  backdrop-filter: blur(22px) saturate(1.1);
  -webkit-backdrop-filter: blur(22px) saturate(1.1);
  -webkit-mask-image: linear-gradient(to left,
    rgba(0, 0, 0, 1) 0%,
    rgba(0, 0, 0, 1) 55%,
    rgba(0, 0, 0, 0.6) 80%,
    rgba(0, 0, 0, 0) 100%);
  mask-image: linear-gradient(to left,
    rgba(0, 0, 0, 1) 0%,
    rgba(0, 0, 0, 1) 55%,
    rgba(0, 0, 0, 0.6) 80%,
    rgba(0, 0, 0, 0) 100%);
  z-index: -1;
  pointer-events: none;
}

/* ── CENTER ──────────────────────────────────────────── */
.gl-center {
  position: absolute;
  top: var(--gl-top-h); left: 0; right: 0; bottom: 0;
  overflow-y: auto;
  overflow-x: auto;
  background: transparent;
  z-index: 1;
}


/* ── MOBILE OVERLAYS ─────────────────────────────────── */
.mob-overlay {
  position: absolute; inset: 0;
  background: rgba(7, 5, 10, 0.5);
  z-index: 7;
}
.mob-side {
  position: absolute; left: 0; top: 0; bottom: 0;
  width: 82%; max-width: 320px;
  background:
    linear-gradient(to right, rgba(26, 21, 16, 0.97), rgba(14, 11, 8, 0.99)),
    var(--vtt-bg-surface);
  backdrop-filter: blur(14px) saturate(1.2);
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
  border-right: 1px solid var(--vtt-border-gold);
  box-shadow: 8px 0 32px rgba(0, 0, 0, 0.55);
  display: flex; flex-direction: column;
  z-index: 8;
  animation: mob-side-in 240ms var(--ease);
}
@keyframes mob-side-in {
  from { transform: translateX(-100%); }
  to   { transform: translateX(0); }
}
.mob-side-close {
  display: flex; justify-content: flex-end;
  padding: 8px 10px 0;
}
.mob-side-body {
  flex: 1 1 auto; min-height: 0;
  overflow-y: auto;
}

.mob-sheet {
  position: absolute; left: 0; right: 0; bottom: 0;
  max-height: 85%;
  background:
    linear-gradient(to bottom, rgba(26, 21, 16, 0.96), rgba(14, 11, 8, 0.98)),
    var(--vtt-bg-surface);
  backdrop-filter: blur(14px) saturate(1.2);
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
  border-top: 1px solid var(--vtt-border-gold);
  border-radius: var(--r-lg) var(--r-lg) 0 0;
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.6);
  display: flex; flex-direction: column;
  z-index: 8;
  animation: mob-sheet-in 240ms var(--ease);
}
@keyframes mob-sheet-in {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
.mob-sheet-handle {
  width: 36px; height: 4px; border-radius: var(--r-pill);
  background: var(--vtt-border-strong);
  margin: 8px auto 0;
}
.mob-sheet-head {
  display: flex; justify-content: flex-end;
  padding: 4px 12px 0;
}
.mob-sheet-body {
  flex: 1 1 auto; min-height: 0;
  overflow-y: auto;
  padding: 4px 0 12px;
}

/* ── SHARED ICON BUTTON (для mob-topbar / close) ─────── */
.btn-icon-sm {
  width: 28px; height: 28px;
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0;
  background: transparent;
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-xs);
  color: var(--vtt-text-muted);
  cursor: pointer;
  transition: border-color var(--t-fast) var(--ease), color var(--t-fast) var(--ease);
}
.btn-icon-sm:hover {
  border-color: var(--vtt-border-strong);
  color: var(--vtt-accent-soft);
}

/* ── RESPONSIVE ──────────────────────────────────────── */
@media (max-width: 960px) {
  .gl-shell {
    --gl-top-h: 44px;
    background-attachment: scroll;
  }
  .gl-top { display: none; }
  .gl-mob-topbar { display: grid; }
  .gl-left, .gl-right { display: none; }
  .gl-center {
    padding-left: 0;
    padding-right: 0;
  }
}

@media (min-width: 961px) and (max-width: 1100px) {
  .gl-shell {
    --gl-left-w: 240px;
    --gl-right-w: 300px;
  }
}
</style>
