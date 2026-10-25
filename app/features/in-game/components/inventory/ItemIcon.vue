<script setup lang="ts">
import type { Component } from 'vue'
import type { ItemDescriptor } from '@/types/character'
import IconWeapon from '@/components/ui/icons/IconWeapon.vue'
import IconArmor from '@/components/ui/icons/IconArmor.vue'
import IconShield from '@/components/ui/icons/IconShield.vue'
import IconBag from '@/components/ui/icons/IconBag.vue'
import IconTool from '@/components/ui/icons/IconTool.vue'
import IconFlask from '@/components/ui/icons/IconFlask.vue'
import IconStar from '@/components/ui/icons/IconStar.vue'

const props = defineProps<{
  kind: ItemDescriptor['kind']
  equipped?: boolean
  consumable?: boolean
}>()

const ICONS: Record<ItemDescriptor['kind'], Component> = {
  weapon: IconWeapon,
  armor: IconArmor,
  shield: IconShield,
  gear: IconBag,
  tool: IconTool,
  occult: IconFlask,
  custom: IconStar,
}
</script>

<template>
  <span :class="['item-icon', { 'is-equipped': props.equipped, 'is-consumable': props.consumable }]">
    <component :is="ICONS[props.kind]" />
  </span>
</template>

<style scoped>
.item-icon {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-sm);
  color: var(--vtt-text-muted);
  background: var(--vtt-bg-sunken);
}
.item-icon :deep(svg) {
  width: 16px;
  height: 16px;
  display: block;
}
.item-icon.is-equipped {
  border-color: var(--vtt-border-gold);
  color: var(--vtt-accent);
  background: rgba(140, 106, 58, 0.1);
}
.item-icon.is-consumable {
  border-style: dashed;
}
</style>
