import type { CharacterStatus } from '@/types/character'
import type { CharacterMeta, Game, GameMember } from '@/types/game'

// Mirrors the server rule: a master edits a character only while its owner is still a member.
export function canEdit(
  meta: CharacterMeta | undefined,
  me: string | null,
  game: Game | undefined,
  members: GameMember[],
): boolean {
  if (!meta || me === null) return false
  if (meta.owner === me) return true
  if (!game || meta.game === '' || game.id !== meta.game) return false
  if (game.master === '' || game.master !== me) return false
  return members.some((m) => m.game === game.id && m.user === meta.owner)
}

export function isMaster(game: Game | undefined, me: string | null): boolean {
  return !!game && me !== null && game.master !== '' && game.master === me
}

export interface ItemSources {
  catalog: boolean
  fromLibrary: boolean
}

// Once a character is created in a game with a master, only the master hands out items, from the library.
export function itemSources(
  status: CharacterStatus,
  meta: CharacterMeta | undefined,
  game: Game | undefined,
  me: string | null,
): ItemSources {
  const gameHasMaster = !!meta && meta.game !== '' && !!game && game.id === meta.game && game.master !== ''
  if (status === 'draft' || !gameHasMaster) return { catalog: true, fromLibrary: false }
  return { catalog: false, fromLibrary: isMaster(game, me) }
}
