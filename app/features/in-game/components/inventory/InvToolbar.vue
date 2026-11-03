<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import IconBag from '@/components/ui/icons/IconBag.vue'
import { t } from '@/locales'

defineProps<{ catalog: boolean; fromLibrary: boolean }>()
defineEmits<{
  (e: 'open-catalog'): void
  (e: 'open-library'): void
}>()
</script>

<template>
  <div class="inv-toolbar">
    <Button v-if="fromLibrary" variant="dashed" class="inv-toolbar-btn" :icon-left="IconBag" @click="$emit('open-library')">
      {{ t('inGame.inventory.fromLibrary') }}
    </Button>
    <Button v-if="catalog" variant="dashed" class="inv-toolbar-btn" :icon-left="IconBag" @click="$emit('open-catalog')">
      {{ t('inGame.inventory.openCatalog') }}
    </Button>
  </div>
</template>

<style scoped>
.inv-toolbar {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}
.inv-toolbar-btn { flex: 1; justify-content: center; }
</style>
