<script setup lang="ts">
import { onMounted } from 'vue'
import { getDiceBox } from '@/services/DiceBoxService'
import { isRolling } from '@/composables/useDiceRoller'
import { createLogger } from '@/utils/logger'

const log = createLogger('dice-overlay')

onMounted(() => {
  getDiceBox().catch(err => log.error('getDiceBox failed', err))
})
</script>

<template>
  <div id="dice-overlay" :class="{ 'dice-overlay--active': isRolling }" />
</template>

<style>
#dice-overlay {
  position: fixed;
  inset: 0;
  z-index: 500;
  pointer-events: none;
}
#dice-overlay canvas {
  width: 100% !important;
  height: 100% !important;
  transition: opacity 400ms ease-out;
}
.dice-overlay--active {
  pointer-events: all;
}
.dice-overlay--fading canvas {
  opacity: 0;
}
</style>
