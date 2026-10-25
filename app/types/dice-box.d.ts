declare module '@3d-dice/dice-box-threejs' {
  interface RollResult {
    type: string
    sides: number
    id: number
    value: number
    [key: string]: unknown
  }

  interface RollSet {
    num: number
    type: string
    sides: number
    rolls: RollResult[]
    total: number
  }

  interface RollOutcome {
    notation: string
    sets: RollSet[]
    modifier: number
    total: number
  }

  interface DiceBoxOptions {
    framerate?: number
    sounds?: boolean
    volume?: number
    color_spotlight?: number
    shadows?: boolean
    theme_surface?: string
    sound_dieMaterial?: string
    theme_customColorset?: unknown
    theme_colorset?: string
    theme_texture?: string
    theme_material?: string
    gravity_multiplier?: number
    light_intensity?: number
    baseScale?: number
    strength?: number
    iterationLimit?: number
    assetPath?: string
    onRollComplete?: (result: RollOutcome) => void
    onRerollComplete?: (results: RollResult[]) => void
    onAddDiceComplete?: (results: RollResult[]) => void
    onRemoveDiceComplete?: (results: RollResult[]) => void
  }

  export default class DiceBox {
    constructor(selector: string, options?: DiceBoxOptions)
    initialize(): Promise<void>
    roll(notation: string): Promise<RollOutcome>
    add(notation: string): Promise<RollResult[]>
    reroll(ids: number[]): Promise<RollResult[]>
    remove(ids: number[]): Promise<RollResult[]>
    clearDice(): void
  }
}
