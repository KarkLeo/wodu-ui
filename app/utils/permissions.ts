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

// UI-only: the true name stays in the character's data, which every member can read.
export function canSeeTrueName(
  meta: CharacterMeta | undefined,
  me: string | null,
  game: Game | undefined,
): boolean {
  if (!meta || me === null) return false
  if (meta.owner === me) return true
  return meta.game !== '' && !!game && game.id === meta.game && isMaster(game, me)
}

// The catalog is open to whoever may edit a character; handing out from the library is the master's alone.
export function canGiveFromLibrary(
  status: CharacterStatus,
  meta: CharacterMeta | undefined,
  game: Game | undefined,
  me: string | null,
): boolean {
  if (status === 'draft' || !meta || meta.game === '' || !game || game.id !== meta.game) return false
  return isMaster(game, me)
}
