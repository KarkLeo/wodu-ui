<script setup lang="ts">
import { ref } from 'vue'
import { TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger } from 'reka-ui'

const props = withDefaults(defineProps<{
  /** Line breaks show. */
  text: string
  /** Asked as the pointer arrives, with the wrapped element; false means there is nothing to add this time. */
  check?: (trigger: HTMLElement) => boolean
  /** A touch has no hover, so a tap toggles it. Only for an element a tap does nothing else on. */
  tap?: boolean
  disabled?: boolean
  side?: 'top' | 'right' | 'bottom' | 'left'
}>(), {
  side: 'top',
})

const open = ref(false)
let worthShowing = true

function setOpen(value: boolean) {
  open.value = value && worthShowing
}

function onEnter(e: PointerEvent) {
  worthShowing = props.check?.(e.currentTarget as HTMLElement) ?? true
}

// A touch's pointerleave closes the tooltip before its click arrives, so the click goes by the state at the press.
let pressedByTouch = false
let openAtPress = false
function onDown(e: PointerEvent) {
  pressedByTouch = e.pointerType === 'touch'
  openAtPress = open.value
}
function onClick() {
  if (props.tap && pressedByTouch && !props.disabled) setOpen(!openAtPress)
}
</script>

<template>
  <TooltipProvider :delay-duration="300" disable-hoverable-content>
    <TooltipRoot :open="open" :disabled="disabled" :disable-closing-trigger="tap" @update:open="setOpen">
      <TooltipTrigger as-child @pointerenter="onEnter" @pointerdown.capture="onDown" @click="onClick">
        <slot />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent class="ui-tooltip" :side="side" :side-offset="6" :collision-padding="12">{{ text }}</TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>

<!-- Not scoped: the portal puts the content under <body>. -->
<style>
.ui-tooltip {
  max-width: min(320px, calc(100vw - 24px));
  padding: 6px 10px;
  background: var(--vtt-elevated-a96);
  border: 1px solid var(--vtt-border-strong);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-2);
  color: var(--vtt-text-primary);
  font-family: var(--font-sans);
  font-size: 12px;
  line-height: 1.4;
  white-space: pre-line;
  overflow-wrap: anywhere;
  z-index: 400;
}
</style>
