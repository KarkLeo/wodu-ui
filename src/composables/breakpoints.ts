// Single source of truth for responsive breakpoints.
// CSS @media rules repeat these numbers by hand (PostCSS @custom-media is not
// wired up). When changing a value here, update every @media in
// src/assets/main.css and in the components too — see the /BREAKPOINTS-ANCHOR/
// comment in main.css for the full list of places.
export const BP_MOBILE_MAX = 719  // inclusive — phone
export const BP_TABLET_MAX = 960  // inclusive — tablet / narrow landscape

export const MQ_MOBILE = `(max-width: ${BP_MOBILE_MAX}px)`
export const MQ_TABLET = `(max-width: ${BP_TABLET_MAX}px)`
