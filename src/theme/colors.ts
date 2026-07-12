// Wake's palette — one warm, consistent identity across every surface (the
// morning Today screen and the evening Reflect ritual both use it). The "evening"
// feeling in Reflect is carried by content — the copy, the moon motif, the
// wind-down — not by a different background.
//
// `day` mirrors the COLORS object still inlined in the Today screen; that screen
// can migrate to import from here when it's next touched (see the consolidation
// follow-up). New code should import from this module.
//
// If a true night mode is ever wanted, do it app-wide and keyed to the actual
// time of day — not as a per-tab surface.

export const day = {
  background: '#FAF8F4', // soft warm cream
  surface: '#FFFFFF', // cards sit just above the cream
  text: '#2A2A2A', // charcoal — the "Wake" wordmark
  muted: '#6E5F4E', // warm brown/gray for secondary text — darkened to clear WCAG AA (4.5:1) on the cream ground
  gold: '#8A6D2F', // deep antique gold — the accent
  goldButton: '#9A7340', // warm antique gold — the START button base
  goldTint: '#FBF6EC', // a whisper of gold — settled/done rows on cream
  border: '#DCDCDC', // subtle grey edge
  divider: '#C4C4C4', // slightly darker hairline rule inside cards
  iconCircle: '#EAEAEA', // light grey chip behind icons
  onAccent: '#FFFFFF', // text/icons sitting on the gold accent
  positive: '#2E7D4F', // muted green
  negative: '#B23B3B', // muted red
} as const

export type Palette = typeof day

// The START / commit button's top→bottom sheen (lighter above, darker below).
// Shared so the Today card, the routine screen, and the evening pivots all match.
export const goldGradient = ['#A87F4A', '#8C6736'] as const
