<script setup lang="ts">
import { definePageMeta } from '#imports'

definePageMeta({
  name: 'in-game',
  redirect: (to) => ({ name: 'party', params: { ids: to.params.id } }),
})
</script>

<template>
  <div />
</template>
