import type {
  FileRef, MediaCollection, Scene, Stage, StageImage, StageScene, StageSound,
} from '@/types/stage'

export const MEDIA_LIMITS = { scenes: 20, sounds: 15, images: 30 } as const
export const IMAGE_MAX_BYTES = 2097152
export const AUDIO_MAX_BYTES = 20971520
export const IMAGE_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp']
export const AUDIO_TYPES: readonly string[] = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac']
export const SCENE_NAME_MAX = 80

export type FileKind = 'image' | 'audio'

const COLLECTIONS: readonly string[] = ['scenes', 'sounds', 'images']

const EXTENSIONS: Record<FileKind, Record<string, string>> = {
  image: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' },
  audio: { 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac' },
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function nonEmpty(v: unknown): v is string {
  return typeof v === 'string' && v !== ''
}

export function emptyStage(gameId: string): Stage {
  return { id: gameId, scene: null, image: null, sound: null }
}

function sceneRef(scene: Scene, name: string | null): FileRef | null {
  return name ? { collection: 'scenes', record: scene.id, name } : null
}

export function withScene(stage: Stage, scene: Scene): Stage {
  return {
    ...stage,
    scene: { id: scene.id, image: sceneRef(scene, scene.image), sound: sceneRef(scene, scene.sound) },
  }
}

export function withoutScene(stage: Stage): Stage {
  return { ...stage, scene: null }
}

function checkFileRef(v: unknown): FileRef | null {
  if (!isRecord(v)) return null
  if (typeof v.collection !== 'string' || !COLLECTIONS.includes(v.collection)) return null
  if (!nonEmpty(v.record) || !nonEmpty(v.name)) return null
  return { collection: v.collection as MediaCollection, record: v.record, name: v.name }
}

function checkOptionalRef(v: unknown): { ok: boolean; ref: FileRef | null } {
  if (v === null || v === undefined) return { ok: true, ref: null }
  const ref = checkFileRef(v)
  return { ok: ref !== null, ref }
}

function checkStageScene(v: unknown): StageScene | null {
  if (!isRecord(v) || !nonEmpty(v.id)) return null
  const image = checkOptionalRef(v.image)
  const sound = checkOptionalRef(v.sound)
  if (!image.ok || !sound.ok) return null
  return { id: v.id, image: image.ref, sound: sound.ref }
}

function checkStageImage(v: unknown): StageImage | null {
  if (!isRecord(v) || !nonEmpty(v.id)) return null
  const file = checkFileRef(v.file)
  if (!file || !nonEmpty(v.shownAt)) return null
  if (v.caption !== null && v.caption !== undefined && typeof v.caption !== 'string') return null
  return { id: v.id, file, caption: typeof v.caption === 'string' ? v.caption : null, shownAt: v.shownAt }
}

function checkStageSound(v: unknown): StageSound | null {
  if (!isRecord(v) || !nonEmpty(v.id)) return null
  const file = checkFileRef(v.file)
  if (!file || typeof v.loop !== 'boolean' || !nonEmpty(v.startedAt)) return null
  return { id: v.id, file, loop: v.loop, startedAt: v.startedAt }
}

export function checkStage(value: unknown, gameId: string): Stage | null {
  if (!isRecord(value) || value.id !== gameId) return null
  return {
    id: gameId,
    scene: checkStageScene(value.scene),
    image: checkStageImage(value.image),
    sound: checkStageSound(value.sound),
  }
}

export function checkSceneData(value: unknown): { id: string; name: string } | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return null
  const id = value.id.trim()
  const name = value.name.trim()
  if (!id || name.length > SCENE_NAME_MAX) return null
  return { id, name }
}

export function checkSceneDraft(
  draft: { name: string; hasImage: boolean; hasSound: boolean },
): Array<'nameRequired' | 'nameTooLong' | 'noFiles'> {
  const problems: Array<'nameRequired' | 'nameTooLong' | 'noFiles'> = []
  const name = draft.name.trim()
  if (!name) problems.push('nameRequired')
  else if (name.length > SCENE_NAME_MAX) problems.push('nameTooLong')
  if (!draft.hasImage && !draft.hasSound) problems.push('noFiles')
  return problems
}

export function checkUpload(kind: FileKind, file: { type: string; size: number }): 'ok' | 'type' | 'size' {
  const types = kind === 'image' ? IMAGE_TYPES : AUDIO_TYPES
  if (!types.includes(file.type)) return 'type'
  const max = kind === 'image' ? IMAGE_MAX_BYTES : AUDIO_MAX_BYTES
  return file.size > max ? 'size' : 'ok'
}

export function neutralFileName(kind: FileKind, type: string): string {
  const ext = Object.prototype.hasOwnProperty.call(EXTENSIONS[kind], type) ? EXTENSIONS[kind][type] : undefined
  if (!ext) throw new Error(`Unsupported ${kind} type: ${type}`)
  return `${kind === 'image' ? 'image' : 'sound'}.${ext}`
}

export function fileUrl(base: string, ref: FileRef, thumb?: string): string {
  const root = base.replace(/\/+$/, '')
  const url = `${root}/api/files/${ref.collection}/${ref.record}/${encodeURIComponent(ref.name)}`
  return thumb ? `${url}?thumb=${encodeURIComponent(thumb)}` : url
}

export function sameFile(a: FileRef | null, b: FileRef | null): boolean {
  if (a === null || b === null) return a === b
  return a.collection === b.collection && a.record === b.record && a.name === b.name
}
