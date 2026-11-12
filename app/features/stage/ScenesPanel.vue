<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from '@/components/ui/Button.vue'
import ConfirmSheet from '@/components/ui/ConfirmSheet.vue'
import MediaPanelShell from './MediaPanelShell.vue'
import SceneRow from './SceneRow.vue'
import SceneSheet from './SceneSheet.vue'
import { useMediaChanges } from '@/composables/useMediaChanges'
import { useMediaDelete } from '@/composables/useMediaDelete'
import { useStageControl } from '@/composables/useStageControl'
import { useTable } from '@/composables/useTable'
import { useMediaStore } from '@/stores/media'
import { deleteScene } from '@/transport/media'
import type { Scene } from '@/types/stage'
import { t } from '@/locales'

const media = useMediaStore()
const { gameId } = useTable()
const { activeSceneId, turnOnScene, turnOffScene } = useStageControl()

// The store holds one game's list; at another game's table it is not this table's to show or to turn on.
const mine = computed(() => media.gameId !== null && media.gameId === gameId.value)
const status = computed(() => (mine.value ? media.scenes.status : 'idle'))
const scenes = computed(() => (mine.value ? media.scenes.list : []))

// A scene's own change (turn on or off, delete) is on its way: its row waits, the others do not.
const { busy, change } = useMediaChanges()

// The stage writer says by itself when a switch did not reach the table, once however many rows waited for
// it, and the highlight follows the store, so the panel adds nothing of its own.
const turnOn = (scene: Scene) => change(scene.id, () => turnOnScene(scene), () => null)
const turnOff = (scene: Scene) => change(scene.id, turnOffScene, () => null)

const rows = new Map<string, { focusDelete: () => void }>()
function setRow(id: string, row: unknown) {
  if (row) rows.set(id, row as { focusDelete: () => void })
  else rows.delete(id)
}

const shell = ref<{ focusAdd: () => void } | null>(null)

const sheetOpen = ref(false)
// Kept after the sheet closes, so its title does not flip to "new scene" while it fades out.
const sheetScene = ref<Scene | undefined>(undefined)

function add() {
  sheetScene.value = undefined
  sheetOpen.value = true
}

function edit(scene: Scene) {
  sheetScene.value = scene
  sheetOpen.value = true
}

const { open: deleteOpen, name: deletingName, ask: askDelete, confirm: confirmDelete } = useMediaDelete<Scene>({
  gameId: () => gameId.value,
  list: () => media.scenes.list,
  busy,
  change,
  remove: deleteScene,
  isLive: scene => activeSceneId.value === scene.id,
  nameOf: scene => scene.name,
  notMasterKey: 'errors.sceneNotMaster',
  failedKey: 'errors.sceneDeleteFailed',
  focusEntry: id => rows.get(id)?.focusDelete(),
  focusAdd: () => shell.value?.focusAdd(),
})
</script>

<template>
  <MediaPanelShell ref="shell" kind="scenes" :status="status" :count="scenes.length" @add="add">
    <ul class="sp-list">
      <SceneRow
        v-for="scene in scenes"
        :key="scene.id"
        :ref="el => setRow(scene.id, el)"
        :scene="scene"
        :active="activeSceneId === scene.id"
        :busy="busy.has(scene.id)"
        @turn-on="turnOn(scene)"
        @turn-off="turnOff(scene)"
        @edit="edit(scene)"
        @delete="askDelete(scene)"
      />
    </ul>

    <template #sheets>
      <SceneSheet v-if="gameId" v-model:open="sheetOpen" :game-id="gameId" :scene="sheetScene" />

      <ConfirmSheet v-model:open="deleteOpen" variant="danger" :title="t('stage.scenes.delete.title', { name: deletingName })">
        <p>{{ t('stage.scenes.delete.body') }}</p>
        <template #actions>
          <Button variant="hero-danger" @click="confirmDelete">{{ t('stage.scenes.delete.confirm') }}</Button>
          <Button variant="ghost" @click="deleteOpen = false">{{ t('common.cancel') }}</Button>
        </template>
      </ConfirmSheet>
    </template>
  </MediaPanelShell>
</template>

<style scoped>
.sp-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
