<script setup lang="ts">
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui'

withDefaults(defineProps<{
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
}>(), {
  side: 'right',
  align: 'start',
  sideOffset: 8,
})

const emit = defineEmits<{
  (e: 'open', open: boolean): void
}>()
</script>

<template>
  <PopoverRoot @update:open="emit('open', $event)">
    <PopoverTrigger as-child>
      <slot name="trigger" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        class="info-popover"
        :side="side"
        :align="align"
        :side-offset="sideOffset"
      >
        <slot />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
