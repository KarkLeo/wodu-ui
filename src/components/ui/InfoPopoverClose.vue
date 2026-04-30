<script setup lang="ts">
import { inject, type Ref } from 'vue'
import { PopoverClose, DialogClose } from 'reka-ui'

withDefaults(defineProps<{ asChild?: boolean }>(), { asChild: false })

const isMobile = inject<Ref<boolean> | null>('infoPopoverIsMobile', null)
</script>

<template>
  <DialogClose v-if="isMobile" :as-child="asChild">
    <slot />
  </DialogClose>
  <PopoverClose v-else :as-child="asChild">
    <slot />
  </PopoverClose>
</template>
