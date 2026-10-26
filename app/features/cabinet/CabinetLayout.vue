<script setup lang="ts">
import bgUrl from '@/assets/bg.jpeg'
import CabinetHeader from './CabinetHeader.vue'
</script>

<template>
  <div class="cl-shell" :style="{ '--cl-bg': `url(${bgUrl})` }">
    <CabinetHeader />
    <main class="cl-main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.cl-shell {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  color: var(--vtt-text-primary);
  background-image:
    linear-gradient(to bottom, rgba(7, 5, 10, 0.78), rgba(7, 5, 10, 0.62) 40%, rgba(7, 5, 10, 0.86)),
    var(--cl-bg);
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
}
.cl-main {
  flex: 1 1 auto;
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  padding: var(--s-5) var(--s-4) var(--s-7);
  display: flex;
  flex-direction: column;
  gap: var(--s-4);
}
</style>
