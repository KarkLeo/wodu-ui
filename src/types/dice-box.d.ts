declare module '@3d-dice/dice-box' {
  interface RollGroup {
    sides: number
    rolls: Array<{ value: number }>
  }

  interface DiceBoxOptions {
    container?: string
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
    onRollComplete?: (results: RollGroup[]) => void
  }

  export default class DiceBox {
    constructor(options: DiceBoxOptions)
    constructor(selector: string, options?: DiceBoxOptions)
    init(): Promise<void>
    roll(notation: string): Promise<RollGroup[]>
    clear(): void
    hide(): void
    show(): void
  }
}
