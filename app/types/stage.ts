export type MediaCollection = 'scenes' | 'sounds' | 'images'
export type MediaKind = MediaCollection

export interface FileRef {
  collection: MediaCollection
  record: string
  name: string
}

/** `image` and `sound` are the stored file names on the record, null when absent. */
export interface Scene {
  id: string
  name: string
  image: string | null
  sound: string | null
}

/** `file` is the stored file name on the record; a sound always has its file. `duration` is in seconds, null when unknown. */
export interface Sound {
  id: string
  name: string
  loop: boolean
  duration: number | null
  file: string
}

/** Temporary stand-in for the image entry; the Shown-images step replaces it with the real type. */
export interface UntypedMediaEntry {
  id: string
}

/** The entry each kind keeps in the master's store. */
export interface MediaEntries {
  scenes: Scene
  sounds: Sound
  images: UntypedMediaEntry
}

/** `file` is the stored file name on the record; an image always has its file. */
export interface TableImage {
  id: string
  caption: string | null
  file: string
}

export interface StageScene {
  id: string
  image: FileRef | null
  sound: FileRef | null
}

export interface StageImage {
  id: string
  file: FileRef
  caption: string | null
  shownAt: string
}

export interface StageSound {
  id: string
  file: FileRef
  loop: boolean
  startedAt: string
}

export interface Stage {
  id: string
  scene: StageScene | null
  image: StageImage | null
  sound: StageSound | null
}
