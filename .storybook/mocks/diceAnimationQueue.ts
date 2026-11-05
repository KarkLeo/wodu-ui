// Stories have no 3D scene and no #dice-overlay to draw it on, so a roll has nothing to animate.
import { readonly, ref } from 'vue'

/** A story sets this to show the rolling state, and puts it back. */
export const animatingMock = ref(false)
export const isAnimating = readonly(animatingMock)

export function enqueueCoalesced(): void {}
