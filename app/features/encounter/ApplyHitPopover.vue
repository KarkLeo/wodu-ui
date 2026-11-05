<script setup lang="ts">
import { PopoverRoot, PopoverAnchor, PopoverPortal, PopoverContent } from 'reka-ui'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import { useIsMobile } from '@/composables/useIsMobile'
import type { ApplyTarget } from '@/composables/useApplyHit'
import type { RollRecord } from '@/types/dice'
import ApplyHitForm from './ApplyHitForm.vue'

const props = defineProps<{
  roll: RollRecord
  target: ApplyTarget
  /** The log row the popup hangs from; a press on it is not an outside press. */
  anchor: HTMLElement | null
}>()
const emit = defineEmits<{ (e: 'apply', amount: number): void }>()
const open = defineModel<boolean>('open', { required: true })

const isMobile = useIsMobile()

function onInteractOutside(e: Event) {
  const target = (e as CustomEvent<{ originalEvent?: Event }>).detail?.originalEvent?.target ?? e.target
  if (props.anchor && target instanceof Node && props.anchor.contains(target)) e.preventDefault()
}

function onApply(amount: number) {
  emit('apply', amount)
  open.value = false
}
</script>

<template>
  <BottomSheet v-if="isMobile" v-model:open="open" :title="target.name">
    <ApplyHitForm :key="`${roll.id}:${target.id}`" :roll="roll" :target="target" @apply="onApply" @cancel="open = false" />
  </BottomSheet>

  <PopoverRoot v-else v-model:open="open">
    <PopoverAnchor v-if="anchor" as="span" hidden :reference="anchor" />
    <PopoverPortal>
      <PopoverContent
        class="info-popover apply-pop"
        :aria-label="target.name"
        side="left"
        align="start"
        :side-offset="8"
        :avoid-collisions="true"
        :collision-padding="12"
        @interact-outside="onInteractOutside"
      >
        <ApplyHitForm :key="`${roll.id}:${target.id}`" :roll="roll" :target="target" @apply="onApply" @cancel="open = false" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style>
/* The popup is portalled to <body>, past the scoped styles of its parents. */
.apply-pop { width: 300px; max-width: calc(100vw - 24px); }
</style>
