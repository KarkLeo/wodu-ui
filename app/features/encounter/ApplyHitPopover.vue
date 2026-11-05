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
  /** Where focus goes when the row cannot take it back (an applied roll stops being a button). */
  fallback?: HTMLElement | null
}>()
const emit = defineEmits<{ (e: 'apply', amount: number): void }>()
const open = defineModel<boolean>('open', { required: true })

const isMobile = useIsMobile()

function onInteractOutside(e: Event) {
  const target = (e as CustomEvent<{ originalEvent?: Event }>).detail?.originalEvent?.target ?? e.target
  if (props.anchor && target instanceof Node && props.anchor.contains(target)) e.preventDefault()
}

// There is no trigger element, so Reka would leave focus on <body>: hand it back to the row. An applied
// row has just lost its tabindex, so wait for the re-render and pick the fallback if it is no longer a stop.
function onCloseAutoFocus(e: Event) {
  e.preventDefault()
  requestAnimationFrame(() => {
    const row = props.anchor
    const stop = row && row.isConnected && row.getAttribute('tabindex') !== null ? row : props.fallback
    stop?.focus({ preventScroll: true })
  })
}

function onApply(amount: number) {
  emit('apply', amount)
  open.value = false
}
</script>

<template>
  <BottomSheet v-if="isMobile" v-model:open="open" :title="target.name" @close-auto-focus="onCloseAutoFocus">
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
        @close-auto-focus="onCloseAutoFocus"
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
