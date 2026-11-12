<script setup lang="ts">
import ShownImageCard from './ShownImageCard.vue'
import { useShownImage } from '@/composables/useShownImage'

const { image, open } = useShownImage()
</script>

<template>
  <ShownImageCard v-if="image" :url="image.url" :caption="image.caption" @open="open()" />
</template>
