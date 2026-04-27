import PocketBase from 'pocketbase'
import type { Character } from '@/types/character'
import type { RollRecord } from '@/types/dice'
import type { ChangeEntry } from '@/types/changeLog'

const PB_URL = import.meta.env.VITE_PB_URL ?? 'http://127.0.0.1:8090'

export const pb = new PocketBase(PB_URL)

pb.autoCancellation(false)
pb.authStore.clear()

export interface CharacterRow {
  id: string
  data: Character
  created: string
  updated: string
}

export interface RollRow {
  id: string
  data: RollRecord
  character_id: string
  created: string
}

export interface ChangeRow {
  id: string
  data: ChangeEntry
  character_id: string
  created: string
}
