<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue'
import Button from '@/components/ui/Button.vue'
import ConfirmSheet from '@/components/ui/ConfirmSheet.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import IconPlus from '@/components/ui/icons/IconPlus.vue'
import StateNote from '@/components/ui/StateNote.vue'
import SceneRow from './SceneRow.vue'
import SceneSheet from './SceneSheet.vue'
import { retryMedia } from '@/composables/useMediaSession'
import { useStageControl } from '@/composables/useStageControl'
import { useTable } from '@/composables/useTable'
import { MEDIA_LIMITS } from '@/domain/stage'
import { useMediaStore } from '@/stores/media'
import { useToastsStore } from '@/stores/toasts'
import { deleteScene, MediaWriteError } from '@/transport/media'
import type { Scene } from '@/types/stage'
import { createLogger } from '@/utils/logger'
import { t } from '@/locales'

const log = createLogger('scenes-panel')
const media = useMediaStore()
const toasts = useToastsStore()
const { gameId } = useTable()
const { activeSceneId, turnOnScene, turnOffScene } = useStageControl()

// The store holds one game's list; at another game's table it is not this table's to show or to turn on.
const mine = computed(() => media.gameId !== null && media.gameId === gameId.value)
const status = computed(() => (mine.value ? media.scenes.status : 'idle'))
const scenes = computed(() => (mine.value ? media.scenes.list : []))
const atLimit = computed(() => scenes.value.length >= MEDIA_LIMITS.scenes)

// A scene's own change (turn on or off, delete) is on its way: its row waits, the others do not.
const busy = reactive(new Set<string>())

// `failed` turns an error into the toast to show, or null for one that needs none.
async function change(scene: Scene, run: () => Promise<void>, failed: (err: unknown) => string | null): Promise<boolean> {
  if (busy.has(scene.id)) return true
  busy.add(scene.id)
  try {
    await run()
    return true
  } catch (err) {
    log.error('scene change failed', { id: scene.id, err })
    const text = failed(err)
    if (text) toasts.push(text, 'error')
    return false
  } finally {
    busy.delete(scene.id)
  }
}

// The stage writer says by itself when a switch did not reach the table, once however many rows waited for
// it, and the highlight follows the store, so the panel adds nothing of its own.
const turnOn = (scene: Scene) => change(scene, () => turnOnScene(scene), () => null)
const turnOff = (scene: Scene) => change(scene, turnOffScene, () => null)

const rows = new Map<string, { focusDelete: () => void }>()
function setRow(id: string, row: unknown) {
  if (row) rows.set(id, row as { focusDelete: () => void })
  else rows.delete(id)
}

const addRef = ref<{ $el: HTMLElement } | null>(null)

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

const deleting = ref<Scene | null>(null)
const deleteOpen = computed({
  get: () => deleting.value !== null,
  set: (v: boolean) => { if (!v) deleting.value = null },
})
// Kept when the sheet closes, or the title loses the name during the closing animation.
const deletingName = ref('')

function askDelete(scene: Scene) {
  deletingName.value = scene.name
  deleting.value = scene
}

async function confirmDelete() {
  const scene = deleting.value
  const game = gameId.value
  if (!scene || !game || busy.has(scene.id)) return
  deleting.value = null
  const wasLive = activeSceneId.value === scene.id
  const done = await change(scene, () => deleteScene(game, scene.id), (err) => {
    // The session ended under the write: nobody is left to tell.
    if (err instanceof MediaWriteError) {
      if (err.kind === 'aborted') return null
      if (err.kind === 'notMaster') return t('errors.sceneNotMaster')
    }
    // A live scene is taken off the table first; if that failed it is still live, and the stage writer has said so.
    if (wasLive && activeSceneId.value === scene.id) return null
    return t('errors.sceneDeleteFailed')
  })
  await nextTick()
  if (!done) {
    rows.get(scene.id)?.focusDelete()
    return
  }
  // The row went with the scene, and with it the button the focus came from.
  if (!media.scenes.list.some(s => s.id === scene.id)) addRef.value?.$el.focus()
}
</script>

<template>
  <section class="sp" :aria-label="t('stage.scenes.title')">
    <header class="sp-head">
      <h2 class="sp-title">{{ t('stage.scenes.title') }}</h2>
      <span v-if="status === 'ready'" class="sp-count">
        {{ t('stage.scenes.count', { count: scenes.length, max: MEDIA_LIMITS.scenes }) }}
      </span>
      <Button
        v-if="status === 'ready'"
        ref="addRef"
        variant="dashed"
        size="sm"
        :icon-left="IconPlus"
        :disabled="atLimit"
        @click="add"
      >
        {{ t('stage.scenes.add') }}
      </Button>
    </header>

    <div class="sp-body">
      <StateNote v-if="status === 'loading' || status === 'idle'" size="sm" role="status">{{ t('stage.scenes.loading') }}</StateNote>
      <StateNote v-else-if="status === 'failed'" size="sm" role="alert">
        {{ t('stage.scenes.loadFailed') }}
        <template #action>
          <Button variant="ghost" size="sm" @click="retryMedia">{{ t('stage.scenes.retry') }}</Button>
        </template>
      </StateNote>
      <template v-else-if="status === 'ready'">
        <!-- Above the list: at the limit the list is long and the note would scroll out of sight. -->
        <StateNote v-if="atLimit" size="sm" inline>{{ t('stage.scenes.limitReached', { max: MEDIA_LIMITS.scenes }) }}</StateNote>
        <EmptyState v-if="!scenes.length" :hint="t('stage.scenes.empty')" />
        <ul v-else class="sp-list">
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
      </template>
    </div>

    <SceneSheet v-if="gameId" v-model:open="sheetOpen" :game-id="gameId" :scene="sheetScene" />

    <ConfirmSheet v-model:open="deleteOpen" variant="danger" :title="t('stage.scenes.delete.title', { name: deletingName })">
      <p>{{ t('stage.scenes.delete.body') }}</p>
      <template #actions>
        <Button variant="hero-danger" @click="confirmDelete">{{ t('stage.scenes.delete.confirm') }}</Button>
        <Button variant="ghost" @click="deleteOpen = false">{{ t('common.cancel') }}</Button>
      </template>
    </ConfirmSheet>
  </section>
</template>

<style scoped>
.sp {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  border-radius: var(--r-lg);
  background: var(--vtt-surface-a88);
  box-shadow: 0 0 0 1px var(--vtt-gold-a35);
  overflow: hidden;
}
.sp-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  /* Room on the right for the column's close button. */
  padding: 12px 40px 10px 14px;
  border-bottom: 1px solid var(--vtt-border-subtle);
}
.sp-title {
  margin: 0;
  font-family: var(--font-serif);
  font-weight: 500;
  font-size: 20px;
  color: var(--vtt-text-primary);
}
.sp-count {
  flex: 1 1 auto;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--vtt-text-muted);
}
.sp-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sp-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
