import { describe, expect, it } from 'vitest'
import { buildLine, PAD_BOTTOM, PAD_TOP, toPoints } from './trendPath'

// The chart was clipping: Catmull-Rom smoothing overshot the data on plateaus,
// so peaks sailed above the canvas and troughs below the baseline. These pin
// the guarantee that every part of the curve — control points included, since
// a bezier never leaves their hull — stays inside the plotting band.

const W = 300
const H = 150
const TOP = PAD_TOP
const BOTTOM = H - PAD_BOTTOM

/** Every y coordinate in the path: the start point plus each segment's two
 *  control points and end point. */
function allYs(path: string): number[] {
  const nums = path.replace(/[MC,]/g, ' ').trim().split(/\s+/).map(Number)
  return nums.filter((_, i) => i % 2 === 1)
}

function pathFor(data: number[]): string {
  return buildLine(toPoints(data, W, H), TOP, BOTTOM)
}

describe('toPoints', () => {
  it('puts the max on the top pad and the min on the bottom pad', () => {
    const pts = toPoints([2, 10, 5], W, H)
    expect(pts[1].y).toBeCloseTo(TOP)
    expect(pts[0].y).toBeCloseTo(BOTTOM)
  })

  it('spans the full inner width, oldest left to newest right', () => {
    const pts = toPoints([1, 2, 3, 4], W, H)
    expect(pts[0].x).toBe(0)
    expect(pts[3].x).toBeCloseTo(W - 6)
  })
})

describe('buildLine stays inside the plotting band', () => {
  it('the exact clip from the bug report: two adjacent maxes after a climb', () => {
    // A steep rise to a two-morning plateau at 10 pushed the control point
    // between the plateau points far above the canvas.
    const ys = allYs(pathFor([2, 10, 10, 3, 6, 2, 9, 7]))
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(TOP - 0.01)
  })

  it('the mirror case: two adjacent mins after a drop', () => {
    const ys = allYs(pathFor([9, 1, 1, 8, 4, 9, 2, 3]))
    expect(Math.max(...ys)).toBeLessThanOrEqual(BOTTOM + 0.01)
  })

  it('holds for every shape: random 14-morning series', () => {
    let seed = 7
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31) * 10
    for (let run = 0; run < 500; run++) {
      const data = Array.from({ length: 14 }, () => Math.round(rand() * 2) / 2)
      if (new Set(data).size < 2) continue
      const ys = allYs(pathFor(data))
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(TOP - 0.01)
      expect(Math.max(...ys)).toBeLessThanOrEqual(BOTTOM + 0.01)
    }
  })

  it('still passes through every data point', () => {
    const data = [3, 7, 2, 9, 5]
    const pts = toPoints(data, W, H)
    const path = pathFor(data)
    for (const p of pts) {
      expect(path).toContain(`${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    }
  })

  it('is empty for fewer than two points', () => {
    expect(buildLine(toPoints([5], W, H), TOP, BOTTOM)).toBe('')
  })
})
