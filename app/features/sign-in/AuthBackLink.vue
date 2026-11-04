<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router'

defineProps<{
  /** Where it goes. Without it this is a button, and the caller handles `click`. */
  to?: RouteLocationRaw
}>()
</script>

<template>
  <RouterLink v-if="to" :to="to" class="auth-back"><slot /></RouterLink>
  <button v-else type="button" class="auth-back"><slot /></button>
</template>

<style scoped>
/* Opaque: it sits on the brightest part of the artwork, and its contrast must not depend on the image. */
.auth-back {
  padding: 6px 12px;
  background: var(--vtt-bg-sunken);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-pill);
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 10px;
  /* A link and a button would otherwise differ in height. */
  line-height: 15px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  text-decoration: none;
  color: var(--vtt-text-secondary);
}
.auth-back:hover { color: var(--vtt-accent-soft); }
</style>
