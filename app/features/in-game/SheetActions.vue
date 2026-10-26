<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
} from 'reka-ui'
import ConfirmSheet from '@/components/ui/ConfirmSheet.vue'
import Button from '@/components/ui/Button.vue'
import IconMenu from '@/components/ui/icons/IconMenu.vue'
import GiveCharacterSheet from '@/components/layout/GiveCharacterSheet.vue'
import { useGameAction } from '@/composables/useGameAction'
import { useCharactersStore } from '@/stores/characters'
import { useGamesStore } from '@/stores/games'
import { currentUser } from '@/transport/auth'
import { mode } from '@/transport/mode'
import { moveCharacter } from '@/transport/games'
import { isMaster } from '@/utils/permissions'
import { t } from '@/locales'
import '@/components/layout/game.css'

const props = defineProps<{ characterId: string }>()

const characters = useCharactersStore()
const games = useGamesStore()
const { busy, run } = useGameAction()

const me = computed(() => currentUser.value?.id ?? null)
const name = computed(() => characters.getById(props.characterId)?.name ?? '')
const meta = computed(() => characters.metaOf(props.characterId))
const game = computed(() => (meta.value?.game ? games.byId(meta.value.game) : undefined))
const mine = computed(() => mode.value === 'online' && !!game.value && me.value !== null && meta.value?.owner === me.value)

const canTakeOut = computed(() => mine.value)
// The server lets the master hand over only characters they own.
const canGive = computed(() => mine.value && isMaster(game.value, me.value))

const takeOutOpen = ref(false)
const giveOpen = ref(false)

// Once the character is free, its column leaves the game's table and this menu with it.
async function confirmTakeOut() {
  const ok = await run('moveCharacter', t('games.sheet.takeOutFailed'), () => moveCharacter(props.characterId, ''))
  if (ok) takeOutOpen.value = false
}
</script>

<template>
  <template v-if="canTakeOut || canGive">
    <DropdownMenuRoot :modal="false">
      <DropdownMenuTrigger class="gm-trigger sa-trigger" :aria-label="t('games.sheet.actions', { name })">
        <IconMenu :size="12" />
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent class="gm-menu" side="bottom" align="end" :side-offset="6">
          <DropdownMenuItem v-if="canGive" class="gm-item" @select="giveOpen = true">{{ t('games.sheet.give') }}</DropdownMenuItem>
          <DropdownMenuItem v-if="canTakeOut" class="gm-item" @select="takeOutOpen = true">{{ t('games.sheet.takeOut') }}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>

    <ConfirmSheet v-model:open="takeOutOpen" :title="t('games.sheet.takeOutTitle', { name })">
      <p>{{ t('games.sheet.takeOutBody') }}</p>
      <template #actions>
        <Button variant="hero" :disabled="busy" @click="confirmTakeOut">{{ t('games.sheet.takeOutConfirm') }}</Button>
        <Button variant="ghost" @click="takeOutOpen = false">{{ t('common.cancel') }}</Button>
      </template>
    </ConfirmSheet>

    <GiveCharacterSheet
      v-if="game"
      v-model:open="giveOpen"
      :character-id="characterId"
      :game-id="game.id"
    />
  </template>
</template>

<style scoped>
.sa-trigger { width: 26px; height: 26px; background: transparent; }
</style>
