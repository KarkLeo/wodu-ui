<script setup lang="ts">
import { watch } from 'vue'
import { PopoverRoot, PopoverAnchor, PopoverPortal, PopoverContent } from 'reka-ui'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import { useIsMobile } from '@/composables/useIsMobile'
import type { ApplyTarget } from '@/composables/useApplyHit'
import type { RollRecord } from '@/types/dice'
import ApplyHitForm from './ApplyHitForm.vue'
import NumberedName from './NumberedName.vue'

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

// How the popup was left decides where focus goes: an outside press keeps the focus the user just chose,
// Apply goes to the fallback (the applied row stops being a button, whenever the write lands), the rest
// (Escape, Cancel) return to the row.
let closedBy: 'outside' | 'apply' | null = null
watch(open, (isOpen) => { if (isOpen) closedBy = null })

function onInteractOutside(e: Event) {
  const target = (e as CustomEvent<{ originalEvent?: Event }>).detail?.originalEvent?.target ?? e.target
  if (props.anchor && target instanceof Node && props.anchor.contains(target)) e.preventDefault()
  else closedBy = 'outside'
}

// There is no trigger element, so Reka would leave focus on <body>: hand it back ourselves.
function onCloseAutoFocus(e: Event) {
  e.preventDefault()
  // Reka reports a close twice; the flag stays until the next open.
  const how = closedBy
  if (how === 'outside') return
  requestAnimationFrame(() => {
    const row = props.anchor
    const stop = how !== 'apply' && row && row.isConnected && row.getAttribute('tabindex') !== null ? row : props.fallback
    stop?.focus({ preventScroll: true })
  })
}

function onApply(amount: number) {
  closedBy = 'apply'
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
        <!-- The popup changes someone's HP and can cover the selected card; the phone's sheet has this in its title. -->
        <h3 class="apply-pop-title"><NumberedName :label="target.name" /></h3>
        <ApplyHitForm :key="`${roll.id}:${target.id}`" :roll="roll" :target="target" @apply="onApply" @cancel="open = false" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style>
/* The popup is portalled to <body>, past the scoped styles of its parents. */
.apply-pop { width: 300px; max-width: calc(100vw - 24px); }
.apply-pop-title {
  margin: 0 0 var(--s-2);
  padding-bottom: var(--s-2);
  border-bottom: 1px solid var(--vtt-border-subtle);
  font-family: var(--font-serif);
  font-size: 18px;
  font-weight: 500;
  color: var(--vtt-text-primary);
}
</style>
