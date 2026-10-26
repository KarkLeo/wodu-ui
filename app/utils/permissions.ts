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
