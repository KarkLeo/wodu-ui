export const SPHERE_PRESETS = [
  'Огонь',
  'Тень',
  'Камень',
  'Молния',
  'Тайны',
  'Страх',
] as const

export type SpherePreset = typeof SPHERE_PRESETS[number]
