declare module '@3d-dice/dice-box' {
  interface DiceBoxOptions {
    assetPath?: string
    gravity?: number
    mass?: number
    friction?: number
    restitution?: number
    angularDamping?: number
    linearDamping?: number
    spinForce?: number
    throwForce?: number
    startingHeight?: number
    settleTimeout?: number
    theme?: string
    themeColor?: string
  }

  interface RollGroup {
    sides: number
    rolls: Array<{ value: number }>
  }

  export default class DiceBox {
    constructor(selector: string, options?: DiceBoxOptions)
    init(): Promise<void>
    roll(notation: string): Promise<RollGroup[]>
    clear(): void
    hide(): void
    show(): void
  }
}
