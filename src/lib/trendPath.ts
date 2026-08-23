// The pure geometry behind TrendChart: series → canvas points → SVG path. Kept
// out of the component so it can be unit-tested; both functions are worklets
// because the chart morphs the curve on the UI thread.

export type Pt = { x: number; y: number }

// Layout paddings keep the curve, end-dot halo (r = 9), and scrub dot inside the
// canvas. Top/bottom must each clear the halo with a little air to spare.
export const PAD_TOP = 16
export const PAD_BOTTOM = 12
export const PAD_RIGHT = 6

// Curve tension: how far each control point reaches toward its neighbours. The
// textbook Catmull-Rom value is 1/6 ≈ 0.167, which reads as nearly-straight,
// sharp-cornered segments. A higher value bows the connections into the soft,
// rounded curve a wellness chart wants. ~0.27 is round without overshooting wildly.
const CURVE_TENSION = 0.27

/** Map a series onto canvas points using its own min/max (with breathing room). */
export function toPoints(data: number[], width: number, height: number): Pt[] {
  const innerH = height - PAD_TOP - PAD_BOTTOM
  const innerW = width - PAD_RIGHT
  const lo = Math.min(...data)
  const hi = Math.max(...data)
  const range = hi - lo || 1
  // Guard the single-point case: i/(length-1) would be 0/0 = NaN with one entry.
  const span = data.length > 1 ? data.length - 1 : 1
  return data.map((v, i) => ({
    x: (i / span) * innerW,
    y: PAD_TOP + innerH - ((v - lo) / range) * innerH,
  }))
}

/**
 * Catmull-Rom → cubic bezier, for a naturally smooth curve through every point.
 *
 * The control points are clamped to [yTop, yBottom]. Unclamped, Catmull-Rom
 * OVERSHOOTS: when two neighbours share the max (a plateau after a climb), the
 * control point between them is pushed well above the data — up to ~27% of the
 * canvas — so the curve sailed off the top and was sliced flat by the canvas
 * edge; the mirror case dipped below the baseline. A cubic bezier always stays
 * inside the hull of its control points, so clamping them guarantees the whole
 * curve stays inside the plotting band while staying just as smooth.
 */
export function buildLine(points: Pt[], yTop: number, yBottom: number): string {
  'worklet'
  if (points.length < 2) return ''
  const clampY = (y: number) => Math.min(yBottom, Math.max(yTop, y))
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]
    const cp1x = p1.x + (p2.x - p0.x) * CURVE_TENSION
    const cp1y = clampY(p1.y + (p2.y - p0.y) * CURVE_TENSION)
    const cp2x = p2.x - (p3.x - p1.x) * CURVE_TENSION
    const cp2y = clampY(p2.y - (p3.y - p1.y) * CURVE_TENSION)
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  return d
}
