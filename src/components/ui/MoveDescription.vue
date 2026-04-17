<script setup lang="ts">
import type { Move } from '@/types/character'
import { formatMove, wrapRoll } from '@/utils/format'

defineProps<{ move: Move }>()
</script>

<template>
  <div class="move-body">
    <template v-if="move.trigger">
      <span class="fmt-trigger" v-html="wrapRoll(move.trigger)" />
      <ul v-if="move.hit10 || move.hit7 || move.miss" class="fmt-tiers">
        <li v-if="move.hit10"><span class="fmt-success">На 10+</span> {{ move.hit10 }}</li>
        <li v-if="move.hit7"><span class="fmt-partial">На 7–9</span> {{ move.hit7 }}</li>
        <li v-if="move.miss"><span class="fmt-fail">На провале</span> {{ move.miss }}</li>
      </ul>
      <ul v-if="move.options" class="fmt-options">
        <li v-for="opt in move.options" :key="opt">{{ opt }}</li>
      </ul>
      <p v-if="move.note" class="fmt-note" v-html="wrapRoll(move.note)" />
    </template>
    <template v-else>
      <span v-if="move.description" v-html="formatMove(move.description)" />
      <ul v-if="move.options" class="fmt-options">
        <li v-for="opt in move.options" :key="opt">{{ opt }}</li>
      </ul>
      <p v-if="move.note" class="fmt-note" v-html="wrapRoll(move.note)" />
    </template>
  </div>
</template>

<style scoped>
.move-body :deep(.fmt-options),
.fmt-options {
  margin: 6px 0 0;
  padding-left: 18px;
  list-style: disc;
}
.fmt-options li { margin: 2px 0; }
.fmt-note { margin: 8px 0 0; font-style: italic; }
</style>
