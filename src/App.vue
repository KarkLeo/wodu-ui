<script setup lang="ts">
import DiceOverlay from '@/components/DiceOverlay.vue'
import DiceDrawer from '@/components/DiceDrawer.vue'
import GameLayout from '@/components/layout/GameLayout.vue'
import PlayersPanel from '@/components/layout/PlayersPanel.vue'
</script>

<template>
  <DiceOverlay />

  <GameLayout>
    <RouterView />

    <template #left>
      <PlayersPanel />
    </template>

    <template #right>
      <DiceDrawer />
    </template>
  </GameLayout>
</template>
