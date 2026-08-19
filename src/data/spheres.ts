export const SPHERE_PRESET_IDS = ['fire', 'shadow', 'stone', 'lightning', 'mysteries', 'fear'] as const
export type SpherePresetId = (typeof SPHERE_PRESET_IDS)[number]
