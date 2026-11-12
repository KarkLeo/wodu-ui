<script setup lang="ts">
import ShownImageReveal from './ShownImageReveal.vue'
import { useShownImage } from '@/composables/useShownImage'

const { image, revealed, openedFromCard } = useShownImage()
</script>

<template>
  <ShownImageReveal v-model:open="revealed" :image="image" :from-card="openedFromCard" />
</template>
