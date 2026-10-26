export const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8

export function generateInviteCode(random: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += INVITE_ALPHABET[Math.floor(random() * INVITE_ALPHABET.length)]
  }
  return code
}

export function formatInviteCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`
}

export function normalizeInviteCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, '')
  if (code.length !== CODE_LENGTH) return null
  return [...code].every((ch) => INVITE_ALPHABET.includes(ch)) ? code : null
}

export function inviteLink(origin: string, code: string): string {
  return `${origin}/join/${code}`
}
