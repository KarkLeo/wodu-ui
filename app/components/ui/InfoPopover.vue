<script setup lang="ts">
import { provide, ref, watch } from 'vue'
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui'
import BottomSheet from './BottomSheet.vue'
import TriggerSlot from './TriggerSlot.vue'
import { useIsMobile } from '@/composables/useIsMobile'

withDefaults(defineProps<{
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  title?: string
}>(), {
  side: 'right',
  align: 'start',
  sideOffset: 8,
})

const emit = defineEmits<{
  (e: 'open', open: boolean): void
}>()

const isMobile = useIsMobile()
const sheetOpen = ref(false)

provide('infoPopoverIsMobile', isMobile)

watch(sheetOpen, (v) => emit('open', v))
</script>

<template>
  <template v-if="isMobile">
    <TriggerSlot @trigger="sheetOpen = true">
      <slot name="trigger" />
    </TriggerSlot>
    <BottomSheet v-model:open="sheetOpen" :title="title">
      <div class="info-popover info-popover--sheet">
        <slot />
      </div>
    </BottomSheet>
  </template>

  <PopoverRoot v-else @update:open="emit('open', $event)">
    <PopoverTrigger as-child>
      <slot name="trigger" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        class="info-popover"
        :side="side"
        :align="align"
        :side-offset="sideOffset"
        :avoid-collisions="true"
        :collision-padding="12"
      >
        <slot />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
