<script setup lang="ts">
import { ref } from 'vue'
import DiceOverlay from '@/components/DiceOverlay.vue'
import DicePanel from '@/features/in-game/components/DicePanel.vue'

const drawerOpen = ref(false)
</script>

<template>
  <DiceOverlay />

  <RouterView />

  <aside class="dice-aside" :class="{ 'dice-aside--open': drawerOpen }">
    <div class="dice-aside__header">
      <div class="dice-aside__title">Кубики</div>
      <button class="dice-aside__close" @click="drawerOpen = false" aria-label="Закрыть">✕</button>
    </div>
    <DicePanel />
  </aside>

  <div
    v-if="drawerOpen"
    class="dice-backdrop"
    @click="drawerOpen = false"
  />

  <button
    v-show="!drawerOpen"
    class="dice-fab"
    aria-label="Открыть кубики"
    @click="drawerOpen = true"
  >
    🎲
  </button>
</template>

<style>
/* Desktop: постоянная панель справа */
@media (min-width: 961px) {
  #app {
    padding-right: 320px;
  }
  .dice-aside {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 320px;
    background: var(--color-bg);
    border-left: 1px solid var(--color-border);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    z-index: 400;
  }
  .dice-fab { display: none; }
}

/* Mobile: drawer по кнопке */
@media (max-width: 960px) {
  .dice-aside {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(360px, 85vw);
    background: var(--color-bg);
    border-left: 1px solid var(--color-border);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    transform: translateX(100%);
    transition: transform 220ms ease-out;
    z-index: 700;
    box-shadow: -4px 0 16px rgba(0, 0, 0, 0.5);
  }
  .dice-aside--open { transform: translateX(0); }
  .dice-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 650;
  }
  .dice-fab {
    position: fixed;
    right: 16px;
    bottom: 16px;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: 1px solid var(--color-border);
    background: var(--color-bg-elevated);
    color: var(--color-accent);
    font-size: 22px;
    cursor: pointer;
    z-index: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  }
}

.dice-aside__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  background: var(--color-bg);
  z-index: 1;
}
.dice-aside__title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--color-text-muted);
}
.dice-aside__close {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
}
@media (min-width: 961px) {
  .dice-aside__close { display: none; }
}
</style>
