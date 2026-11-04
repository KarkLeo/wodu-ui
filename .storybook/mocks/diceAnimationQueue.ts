// Stories have no 3D scene and no #dice-overlay to draw it on, so a roll has nothing to animate.
import { readonly, ref } from 'vue'

export const isAnimating = readonly(ref(false))

export function enqueueCoalesced(): void {}
