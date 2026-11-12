<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import Button from '@/components/ui/Button.vue'
import ConfirmSheet from '@/components/ui/ConfirmSheet.vue'
import IconButton from '@/components/ui/IconButton.vue'
import IconEdit from '@/components/ui/icons/IconEdit.vue'
import IconTrash from '@/components/ui/icons/IconTrash.vue'
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
const selectedBusy = computed(() => selected.value !== null && busy.has(selected.value.id))

// The stage writer says by itself when a switch did not reach the table, so the panel adds nothing of its own;
// the highlight follows the store and stays as it was.
const show = (image: TableImage, withCaption: boolean) => change(image.id, () => showImage(image, withCaption), () => null)
const hide = (image: TableImage) => change(image.id, hideImage, () => null)

const shell = ref<{ focusAdd: () => void } | null>(null)
const mainRef = ref<{ $el: HTMLElement } | null>(null)
const plainRef = ref<{ $el: HTMLElement } | null>(null)
const editRef = ref<{ $el: HTMLElement } | null>(null)
const deleteRef = ref<{ $el: HTMLElement } | null>(null)
useBusyFocus(() => selectedBusy.value, [mainRef, plainRef, editRef, deleteRef])

// "Show without caption" is gone once the image is shown, and the focus goes to the one button left in its place.
async function switched(done: Promise<boolean>) {
  await done
  await nextTick()
  if (!document.activeElement || document.activeElement === document.body) mainRef.value?.$el.focus()
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

const { open: deleteOpen, live: deletingShown, ask: askDelete, confirm: confirmDelete } = useMediaDelete<TableImage>({
  gameId: () => gameId.value,
  list: () => media.images.list,
  busy,
  change,
  remove: deleteImage,
  isLive: image => shownImageId.value === image.id,
  notMasterKey: 'errors.imageNotMaster',
  failedKey: 'errors.imageDeleteFailed',
  focusEntry: () => deleteRef.value?.$el.focus(),
  focusAdd: () => shell.value?.focusAdd(),
})
</script>

<template>
  <MediaPanelShell ref="shell" kind="images" :status="status" :count="images.length" @add="add">
    <div role="radiogroup" :aria-label="t('stage.images.title')" class="ip-grid">
      <ImageTile
        v-for="image in images"
        :key="image.id"
        :image="image"
        :selected="selectedId === image.id"
        :shown="shownImageId === image.id"
        :tabindex="tabIndexFor(image.id)"
        @select="selectedId = image.id"
        @keydown="onKeydown"
      />
    </div>

    <template #footer>
      <div class="ip-bar">
        <div v-if="selected" role="group" :aria-label="t('stage.images.actions.label')" class="ip-actions">
          <Button
            ref="mainRef"
            :variant="isShown ? 'ghost' : 'primary'"
            size="sm"
            :disabled="selectedBusy"
            @click="switched(isShown ? hide(selected) : show(selected, true))"
          >
            {{ isShown ? t('stage.images.actions.hide') : t('stage.images.actions.show') }}
          </Button>
          <Button
            v-if="selected.caption && !isShown"
            ref="plainRef"
            variant="ghost"
            size="sm"
            :disabled="selectedBusy"
            @click="switched(show(selected, false))"
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
        <p v-else class="ip-hint">{{ t('stage.images.actions.hint') }}</p>
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
.ip-hint {
  margin: 0;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 12px;
  color: var(--vtt-text-muted);
}
</style>
