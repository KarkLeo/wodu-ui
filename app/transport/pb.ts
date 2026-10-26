import PocketBase from 'pocketbase'
import type { Character } from '@/types/character'
import type { RollRecord } from '@/types/dice'
import type { ChangeEntry } from '@/types/changeLog'

// The bootstrap plugin points this at runtimeConfig.public.pbUrl before the first request.
export const pb = new PocketBase('http://127.0.0.1:8090')

pb.autoCancellation(false)

export interface CharacterRow {
  id: string
  data: Character
  owner: string
  created: string
  updated: string
}

export interface RollRow {
  id: string
  data: RollRecord
  character_id: string
  character: string
  created: string
}

export interface ChangeRow {
  id: string
  data: ChangeEntry
  character_id: string
  character: string
  created: string
}
