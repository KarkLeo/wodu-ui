export interface Game {
  id: string
  name: string
  master: string
  inviteCode: string
}

export interface GameMember {
  id: string
  game: string
  user: string
  name: string
}

export interface CharacterMeta {
  owner: string
  game: string
}

// `solo` is the table of my free characters.
export type Scope =
  | { kind: 'home' }
  | { kind: 'game'; gameId: string }
  | { kind: 'solo' }
