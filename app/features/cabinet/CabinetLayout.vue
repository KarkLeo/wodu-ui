<script setup lang="ts">
import bgUrl from '@/assets/bg.jpeg'
import ScreenColumn from '@/components/layout/ScreenColumn.vue'
import CabinetHeader from './CabinetHeader.vue'
</script>

<template>
  <div class="cl-shell" :style="{ '--cl-bg': `url(${bgUrl})` }">
    <CabinetHeader />
    <ScreenColumn as="main" class="cl-main">
      <slot />
    </ScreenColumn>
  </div>
</template>

<style scoped>
.cl-shell {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  color: var(--vtt-text-primary);
  background-image:
    linear-gradient(to bottom, var(--vtt-sunken-a78), var(--vtt-sunken-a62) 40%, var(--vtt-sunken-a86)),
    var(--cl-bg);
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
}
.cl-main { flex: 1 1 auto; }
</style>
