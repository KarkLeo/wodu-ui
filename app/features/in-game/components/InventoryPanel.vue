<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Character, InventoryItem } from '@/types/character'
import type { CharacterCommand } from '@/domain/commands'
import { useInventory } from '@/composables/useInventory'
import { useMercury } from '@/composables/useMercury'
import { isRolling } from '@/composables/useDiceRoller'
import { useSheetReadonly } from '@/composables/useSheetReadonly'
import { findGearTemplate } from '@/data/gear'
import { useCharactersStore } from '@/stores/characters'
import { useGamesStore } from '@/stores/games'
import { currentUser } from '@/transport/auth'
import { itemSources } from '@/utils/permissions'
import { t } from '@/locales'
import { gearName } from '@/locales/content'

import InvWarning from './inventory/InvWarning.vue'
import InvSection from './inventory/InvSection.vue'
import InvItem from './inventory/InvItem.vue'
import InvToolbar from './inventory/InvToolbar.vue'
import CatalogSheet from './inventory/CatalogSheet.vue'
import LibraryPickSheet from './inventory/LibraryPickSheet.vue'
import ConfirmSheet from '@/components/ui/ConfirmSheet.vue'
import Button from '@/components/ui/Button.vue'

type Dispatcher = (cmd: CharacterCommand) => void

const props = defineProps<{ char: Character; dispatch: Dispatcher }>()

const readonly = useSheetReadonly()
const inv = useInventory(props.dispatch)
const {
  overdoseOpen,
  drink: drinkQuicksilver,
  reset: resetQuicksilver,
  rollOverdose,
} = useMercury(() => props.char, props.dispatch)

const characters = useCharactersStore()
const games = useGamesStore()

const meta = computed(() => characters.metaOf(props.char.id))
const gameId = computed(() => meta.value?.game ?? '')
const sources = computed(() => itemSources(
  props.char.status,
  meta.value,
  gameId.value ? games.byId(gameId.value) : undefined,
  currentUser.value?.id ?? null,
))

const catalogOpen = ref(false)
const libraryOpen = ref(false)

const gmPendingId = ref<string | null>(null)
const gmPending = computed(() => gmPendingId.value ? findGearTemplate(gmPendingId.value) ?? null : null)
const gmOpen = computed({
  get: () => gmPendingId.value !== null,
  set: v => { if (!v) gmPendingId.value = null },
})

const equipped = computed(() => props.char.inventory.filter(i => i.equipped))
const backpack = computed(() => props.char.inventory.filter(i => !i.equipped))

const multipleWeaponsEquipped = computed(() =>
  equipped.value.filter(i => i.descriptor.kind === 'weapon').length > 1
)

const equippedSummary = computed(() => {
  const parts: string[] = []
  const weapon = equipped.value.find(i => i.descriptor.kind === 'weapon')
  if (weapon?.damage) parts.push(`${t('inGame.inventory.summary.damage')} ${weapon.damage}`)
  let armor = 0
  for (const it of equipped.value) {
    if (it.descriptor.kind === 'armor') {
      if (it.descriptor.class === 'full') armor += 2
      else if (it.descriptor.class === 'light') armor += 1
    } else if (it.descriptor.kind === 'shield') {
      armor += 1
    }
  }
  if (armor > 0) parts.push(`${t('inGame.inventory.summary.armor')} ${armor}`)
  return parts.join(' · ')
})

function onToggleEquip(item: InventoryItem) {
  if (item.equipped) inv.unequip(item.id)
  else inv.equip(item.id)
}

function onUse(item: InventoryItem) {
  const tpl = item.templateId ? findGearTemplate(item.templateId) : undefined
  if (tpl?.useEffect === 'quicksilver') {
    drinkQuicksilver(item.id)
    return
  }
  inv.use(item.id)
}

function onRemove(item: InventoryItem) {
  inv.remove(item.id)
}

function onBuyTemplate(templateId: string) {
  inv.buy(templateId)
}

function onRequestGm(templateId: string) {
  gmPendingId.value = templateId
}

function gmApprove() {
  const tpl = gmPending.value
  if (!tpl) return
  inv.receive({
    templateId: tpl.templateId,
    name: '',
    descriptor: tpl.descriptor,
    damage: tpl.damage,
    price: tpl.price,
  })
  gmPendingId.value = null
}
function gmCancel() { gmPendingId.value = null }
</script>

<template>
  <section class="inv-panel">
    <InvWarning v-if="multipleWeaponsEquipped">
      <b>{{ t('inGame.inventory.multipleWeapons.title') }}</b>
      {{ ' ' + t('inGame.inventory.multipleWeapons.body') }}
    </InvWarning>

    <InvSection
      v-if="equipped.length"
      :title="t('inGame.inventory.sections.equipped')"
      :count="equipped.length"
      :summary="equippedSummary || undefined"
    >
      <InvItem
        v-for="item in equipped"
        :key="item.id"
        :item="item"
        @toggle-equip="onToggleEquip(item)"
        @use="onUse(item)"
        @remove="onRemove(item)"
      />
    </InvSection>

    <InvSection
      :title="t('inGame.inventory.sections.backpack')"
      :count="backpack.length"
    >
      <InvItem
        v-for="item in backpack"
        :key="item.id"
        :item="item"
        @toggle-equip="onToggleEquip(item)"
        @use="onUse(item)"
        @remove="onRemove(item)"
      />
      <div v-if="!backpack.length" class="inv-empty">{{ t('inGame.inventory.empty') }}</div>
    </InvSection>

    <template v-if="!readonly">
      <InvToolbar
        v-if="sources.catalog || sources.fromLibrary"
        :catalog="sources.catalog"
        :from-library="sources.fromLibrary"
        @open-catalog="catalogOpen = true"
        @open-library="libraryOpen = true"
      />

      <CatalogSheet
        v-if="sources.catalog"
        v-model:open="catalogOpen"
        :coins="char.coins"
        @buy="onBuyTemplate"
        @request-gm="onRequestGm"
      />

      <LibraryPickSheet
        v-if="sources.fromLibrary"
        v-model:open="libraryOpen"
        :game-id="gameId"
        :character-id="char.id"
      />

      <ConfirmSheet
        v-if="sources.catalog && gmPending"
        v-model:open="gmOpen"
        variant="gold"
        :title="t('inGame.inventory.gm.title')"
      >
        <p>
          {{ t('inGame.inventory.gm.body', { name: gearName(gmPending.templateId), price: gmPending.price ?? 0, coins: char.coins }) }}
        </p>
        <template #actions>
          <Button variant="hero" @click="gmApprove">{{ t('inGame.inventory.gm.approve') }}</Button>
          <Button variant="ghost" @click="gmCancel">{{ t('inGame.inventory.gm.discuss') }}</Button>
        </template>
      </ConfirmSheet>

      <ConfirmSheet
        v-model:open="overdoseOpen"
        variant="danger"
        :title="t('inGame.inventory.overdose.title')"
      >
        <p>
          {{ t('inGame.inventory.overdose.body', { count: char.quicksilverCount ?? 0, level: char.level }) }}
        </p>
        <template #actions>
          <Button variant="hero" :disabled="isRolling" @click="rollOverdose">
            {{ t('inGame.inventory.overdose.roll') }}
          </Button>
          <Button variant="primary" @click="resetQuicksilver">
            {{ t('inGame.inventory.overdose.reset') }}
          </Button>
          <Button variant="ghost" @click="overdoseOpen = false">{{ t('common.cancel') }}</Button>
        </template>
      </ConfirmSheet>
    </template>
  </section>
</template>

<style scoped>
.inv-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px;
}
.inv-empty {
  padding: 22px 14px;
  text-align: center;
  color: var(--vtt-text-muted);
  font-size: 13px;
  font-style: italic;
  border: 1px dashed var(--vtt-border-subtle);
  border-radius: var(--r-sm);
}
</style>
