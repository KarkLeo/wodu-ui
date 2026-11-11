export type MediaCollection = 'scenes' | 'sounds' | 'images'

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
