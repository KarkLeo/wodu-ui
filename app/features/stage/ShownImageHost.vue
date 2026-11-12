<script setup lang="ts">
import ShownImageReveal from './ShownImageReveal.vue'
import { useShownImage } from '@/composables/useShownImage'

const { image, revealed } = useShownImage()
</script>

<template>
  <ShownImageReveal v-model:open="revealed" :image="image" />
</template>
