export const GAME_NAME_MAX = 80

/** Why a game name would be refused (the server's limit, checked on the trimmed name), or null. */
export function gameNameError(name: string): 'empty' | 'tooLong' | null {
  const trimmed = name.trim()
  if (!trimmed) return 'empty'
  return trimmed.length > GAME_NAME_MAX ? 'tooLong' : null
}
