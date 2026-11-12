<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import Button from '@/components/ui/Button.vue'
import AlertBanner from '@/components/ui/AlertBanner.vue'
import ConfirmSheet from '@/components/ui/ConfirmSheet.vue'
import IconButton from '@/components/ui/IconButton.vue'
import IconEdit from '@/components/ui/icons/IconEdit.vue'
import IconTrash from '@/components/ui/icons/IconTrash.vue'
import StateNote from '@/components/ui/StateNote.vue'
import ImageSheet from './ImageSheet.vue'
import ImageTile from './ImageTile.vue'
import MediaPanelShell from './MediaPanelShell.vue'
import { useBusyFocus } from '@/composables/useBusyFocus'
import { useMediaChanges } from '@/composables/useMediaChanges'
import { useMediaDelete } from '@/composables/useMediaDelete'
import { useRovingSelection } from '@/composables/useRovingSelection'
import { useStageControl } from '@/composables/useStageControl'
import { useTable } from '@/composables/useTable'
import { useMediaStore } from '@/stores/media'
import { deleteImage } from '@/transport/media'
import type { TableImage } from '@/types/stage'
import { t } from '@/locales'

const media = useMediaStore()
const { gameId } = useTable()
const { shownImageId, showImage, hideImage } = useStageControl()

// The store holds one game's list; at another game's table it is not this table's to show or to put on the table.
const mine = computed(() => media.gameId !== null && media.gameId === gameId.value)
const status = computed(() => (mine.value ? media.images.status : 'idle'))
const images = computed(() => (mine.value ? media.images.list : []))

// An image's own change (show, hide, delete) is on its way: its buttons wait, the rest of the panel does not.
const { busy, change } = useMediaChanges()

// One image is selected at a time, none at first; the bar under the grid acts on it.
const selectedId = ref<string | null>(null)
const selected = computed(() => images.value.find(i => i.id === selectedId.value) ?? null)
watch(images, (list) => {
  if (selectedId.value !== null && !list.some(i => i.id === selectedId.value)) selectedId.value = null
})
const { tabIndexFor, onKeydown } = useRovingSelection<string | null>(
  () => images.value.map(i => ({ value: i.id as string | null })),
  selectedId,
)

const isShown = computed(() => selected.value !== null && shownImageId.value === selected.value.id)
// The shown image can be missing from the gallery (deleted elsewhere, or the list did not load): the master must still be able to clear the table.
const orphanShown = computed(() =>
  (status.value === 'ready' || status.value === 'failed') && shownImageId.value !== null && !images.value.some(i => i.id === shownImageId.value))
const orphanBusy = computed(() => shownImageId.value !== null && busy.has(shownImageId.value))

const selectedPosition = computed(() => images.value.findIndex(i => i.id === selectedId.value) + 1)
const barLabel = computed(() => (selected.value?.caption
  ? t('stage.images.actions.labelCaption', { caption: selected.value.caption })
  : t('stage.images.actions.labelPosition', { n: selectedPosition.value, total: images.value.length })))

const selectedBusy = computed(() => selected.value !== null && busy.has(selected.value.id))

// The stage writer says by itself when a switch did not reach the table, so the panel adds nothing of its own;
// the highlight follows the store and stays as it was.
const show = (image: TableImage, withCaption: boolean) => change(image.id, () => showImage(image, withCaption), () => null)
const hide = (image: TableImage) => change(image.id, hideImage, () => null)

const shell = ref<{ focusAdd: () => void } | null>(null)

// Once hidden, the notice goes with the button the focus was on: it moves to the upload button instead of the page.
async function hideOrphan() {
  const id = shownImageId.value
  if (!id || !(await change(id, hideImage, () => null))) return
  await nextTick()
  const active = document.activeElement
  if (!active || active === document.body) shell.value?.focusAdd()
}
const mainRef = ref<{ $el: HTMLElement } | null>(null)
const plainRef = ref<{ $el: HTMLElement } | null>(null)
const editRef = ref<{ $el: HTMLElement } | null>(null)
const deleteRef = ref<{ $el: HTMLElement } | null>(null)
useBusyFocus(() => selectedBusy.value, [mainRef, plainRef, editRef, deleteRef])

// The show buttons follow the stage, so the pressed one may be replaced (rolled back after a refusal) or gone ("Show without caption"
// once the image is shown): the focus goes to the button now in its place, or to the main one when there is none.
async function switched(done: Promise<boolean>, pressed: 'main' | 'plain') {
  await done
  await nextTick()
  const active = document.activeElement
  if (active && active !== document.body) return
  ;(pressed === 'plain' ? plainRef.value : null)?.$el.focus()
  if (document.activeElement === document.body || !document.activeElement) mainRef.value?.$el.focus()
}

const sheetOpen = ref(false)
// Kept after the sheet closes, so its title does not flip to "new image" while it fades out.
const sheetImage = ref<TableImage | undefined>(undefined)

function add() {
  sheetImage.value = undefined
  sheetOpen.value = true
}

function edit(image: TableImage) {
  sheetImage.value = image
  sheetOpen.value = true
}

const { open: deleteOpen, live: deletingShown, ask, confirm: confirmDelete } = useMediaDelete<TableImage>({
  gameId: () => gameId.value,
  list: () => media.images.list,
  busy,
  change,
  remove: deleteImage,
  isLive: image => shownImageId.value === image.id,
  notMasterKey: 'errors.imageNotMaster',
  failedKey: 'errors.imageDeleteFailed',
  focusEntry: () => deleteRef.value?.$el.focus(),
  focusAdd: focusGrid,
})

// The tile that took the deleted one's place gets the focus; the upload button only when no tile is left.
let deletedAt = 0
const grid = ref<HTMLElement | null>(null)
function askDelete(image: TableImage) {
  deletedAt = images.value.findIndex(i => i.id === image.id)
  ask(image)
}
function focusGrid() {
  const tiles = grid.value?.querySelectorAll<HTMLElement>('[role="radio"]')
  if (tiles?.length) tiles[Math.min(deletedAt, tiles.length - 1)]!.focus()
  else shell.value?.focusAdd()
}
</script>

<template>
  <MediaPanelShell ref="shell" kind="images" :status="status" :count="images.length" @add="add">
    <div ref="grid" role="radiogroup" :aria-label="t('stage.images.title')" class="ip-grid">
      <ImageTile
        v-for="(image, index) in images"
        :key="image.id"
        :image="image"
        :selected="selectedId === image.id"
        :shown="shownImageId === image.id"
        :position="index + 1"
        :total="images.length"
        :tabindex="tabIndexFor(image.id)"
        @select="selectedId = image.id"
        @keydown="onKeydown"
      />
    </div>

    <template #notice>
      <AlertBanner v-if="orphanShown" tone="warning" class="ip-orphan">
        {{ t('stage.images.orphan.text') }}
        <template #action>
          <Button variant="ghost" size="sm" :disabled="orphanBusy" @click="hideOrphan">{{ t('stage.images.orphan.hide') }}</Button>
        </template>
      </AlertBanner>
    </template>

    <template #footer>
      <div class="ip-bar">
        <div v-if="selected" role="group" :aria-label="barLabel" class="ip-actions">
          <Button
            ref="mainRef"
            :variant="isShown ? 'ghost' : 'primary'"
            size="sm"
            :disabled="selectedBusy"
            @click="switched(isShown ? hide(selected) : show(selected, true), 'main')"
          >
            {{ isShown ? t('stage.images.actions.hide') : t('stage.images.actions.show') }}
          </Button>
          <Button
            v-if="selected.caption && !isShown"
            ref="plainRef"
            variant="ghost"
            size="sm"
            :disabled="selectedBusy"
            @click="switched(show(selected, false), 'plain')"
          >
            {{ t('stage.images.actions.showWithoutCaption') }}
          </Button>
          <span class="ip-spacer" />
          <IconButton ref="editRef" variant="square" :label="t('stage.images.actions.edit')" :disabled="selectedBusy" @click="edit(selected)">
            <IconEdit :size="14" />
          </IconButton>
          <IconButton
            ref="deleteRef"
            variant="square"
            tone="danger"
            :label="t('stage.images.actions.delete')"
            :disabled="selectedBusy"
            @click="askDelete(selected)"
          >
            <IconTrash :size="14" />
          </IconButton>
        </div>
        <StateNote v-else size="sm" inline align="start">{{ t('stage.images.actions.hint') }}</StateNote>
      </div>
    </template>

    <template #sheets>
      <ImageSheet v-if="gameId" v-model:open="sheetOpen" :game-id="gameId" :image="sheetImage" />

      <ConfirmSheet v-model:open="deleteOpen" variant="danger" :title="t('stage.images.delete.title')">
        <p>{{ deletingShown ? t('stage.images.delete.bodyShown') : t('stage.images.delete.body') }}</p>
        <template #actions>
          <Button variant="hero-danger" @click="confirmDelete">{{ t('stage.images.delete.confirm') }}</Button>
          <Button variant="ghost" @click="deleteOpen = false">{{ t('common.cancel') }}</Button>
        </template>
      </ConfirmSheet>
    </template>
  </MediaPanelShell>
</template>

<style scoped>
.ip-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.ip-bar {
  padding: 8px 10px 10px;
  border-top: 1px solid var(--vtt-border-subtle);
}
.ip-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.ip-spacer { flex: 1 1 0; }
.ip-orphan { margin: 8px 10px 0; }
</style>
