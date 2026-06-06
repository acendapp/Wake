import { useEffect, useMemo, useRef, useState } from 'react'
import { PanResponder, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient as SvgGradient,
  Path,
  Stop,
} from 'react-native-svg'

import { day } from '@/theme/colors'

// A smooth editorial area chart — one metric over time. No gridlines, no axes,
// no chart-library chrome: a single calm line with a soft wash beneath it, the
// way a print magazine would set a trend.
//
// Motion: on mount the curve rises out of the baseline; on data change it morphs
// from the old curve into the new one (every point interpolated on the UI thread
// via Reanimated, so the line never blinks or redraws abruptly).
//
// Touch: press and drag to scrub. The finger snaps to the nearest morning; a
// hairline, a dot on the curve, and a value/date readout follow it. Releasing
// (or the page stealing the gesture for a vertical scroll) dismisses it.

const AnimatedPath = Animated.createAnimatedComponent(Path)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

type Props = {
  /** The series, oldest → newest. */
  data: number[]
  /** One label per point, for the scrub readout (e.g. "May 18", …, "Today"). */
  labels?: string[]
  width: number
  height: number
  /** Line + fill color (the fill is this color washed out). */
  color: string
  /** Color for the scrub readout text. Defaults to the line color. */
  readoutColor?: string
}

type Pt = { x: number; y: number }

/** Catmull-Rom → cubic bezier, for a naturally smooth curve through every point. */
function buildLine(points: Pt[]): string {
  'worklet'
  if (points.length < 2) return ''
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  return d
}

// Layout paddings keep the curve, end-dot halo, and scrub dot inside the canvas.
const PAD_TOP = 12
const PAD_BOTTOM = 8
const PAD_RIGHT = 6

/** Map a series onto canvas points using its own min/max (with breathing room). */
function toPoints(data: number[], width: number, height: number): Pt[] {
  const innerH = height - PAD_TOP - PAD_BOTTOM
  const innerW = width - PAD_RIGHT
  const lo = Math.min(...data)
  const hi = Math.max(...data)
  const range = hi - lo || 1
  return data.map((v, i) => ({
    x: (i / (data.length - 1)) * innerW,
    y: PAD_TOP + innerH - ((v - lo) / range) * innerH,
  }))
}

export function TrendChart({
  data,
  labels,
  width,
  height,
  color,
  readoutColor,
}: Props) {
  // Morph state: where the curve is animating from. null = first mount, where it
  // rises out of a flat baseline.
  const [fromData, setFromData] = useState<number[] | null>(null)
  const prevData = useRef<number[]>(data)
  const progress = useSharedValue(0)

  useEffect(() => {
    if (prevData.current !== data) {
      setFromData(prevData.current)
      prevData.current = data
    }
    progress.value = 0
    progress.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })
    // progress is a stable shared value; only the data identity matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  // Scrub state: which morning the finger is on, or null when not scrubbing.
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const target = useMemo(() => toPoints(data, width, height), [data, width, height])
  const origin = useMemo(() => {
    if (fromData) return toPoints(fromData, width, height)
    // First mount: every point starts on the baseline and rises into place.
    const baseY = height - PAD_BOTTOM
    return target.map((p) => ({ x: p.x, y: baseY }))
  }, [fromData, target, width, height])

  // The morphing paths, interpolated point-by-point on the UI thread.
  const lineProps = useAnimatedProps(() => {
    const pts = target.map((p, i) => ({
      x: p.x,
      y: origin[i].y + (p.y - origin[i].y) * progress.value,
    }))
    return { d: buildLine(pts) }
  })
  const areaProps = useAnimatedProps(() => {
    const pts = target.map((p, i) => ({
      x: p.x,
      y: origin[i].y + (p.y - origin[i].y) * progress.value,
    }))
    const last = pts[pts.length - 1]
    return { d: `${buildLine(pts)} L ${last.x.toFixed(2)} ${height} L ${pts[0].x.toFixed(2)} ${height} Z` }
  })
  const endDot = target[target.length - 1]
  const endDotProps = useAnimatedProps(() => ({
    cy: origin[origin.length - 1].y + (endDot.y - origin[origin.length - 1].y) * progress.value,
  }))

  // Press-and-drag scrubbing, snapped to the nearest morning. The responder owns
  // the whole chart block (readout lane + canvas), and the Svg is transparent to
  // touch, so a drag can start from anywhere — not just on the drawn line. The
  // finger's position is tracked as grant-x + dx (gestureState), which stays
  // consistent for the whole drag no matter what sits under the finger.
  const innerW = width - PAD_RIGHT
  const scrubStartX = useRef(0)
  const pan = useMemo(() => {
    const indexAt = (x: number) =>
      Math.max(0, Math.min(data.length - 1, Math.round((x / innerW) * (data.length - 1))))
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        scrubStartX.current = e.nativeEvent.locationX
        setActiveIndex(indexAt(scrubStartX.current))
      },
      onPanResponderMove: (_e, g) => setActiveIndex(indexAt(scrubStartX.current + g.dx)),
      onPanResponderRelease: () => setActiveIndex(null),
      onPanResponderTerminate: () => setActiveIndex(null),
      // Only surrender the gesture when the finger is clearly scrolling the page
      // (mostly vertical). A horizontal scrub keeps the responder to the end.
      onPanResponderTerminationRequest: (_e, g) => Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      // Android: stop the native ScrollView from intercepting mid-scrub.
      onShouldBlockNativeResponder: () => true,
    })
  }, [data.length, innerW])

  if (data.length < 2 || width <= 0) return <View style={{ width, height }} />

  const active = activeIndex != null ? target[activeIndex] : null
  // Keep the readout inside the canvas: centered on the point, clamped at edges.
  const READOUT_W = 92
  const readoutLeft =
    active != null ? Math.max(0, Math.min(width - READOUT_W, active.x - READOUT_W / 2)) : 0

  return (
    // The whole block (readout lane + canvas) is one touch surface for scrubbing.
    <View style={{ width }} {...pan.panHandlers}>
      {/* The readout floats above the canvas so it never collides with the curve. */}
      <View style={styles.readoutLane} pointerEvents="none">
        {active != null && activeIndex != null && (
          <View style={[styles.readout, { left: readoutLeft }]}>
            <Text style={[styles.readoutValue, { color: readoutColor ?? color }]}>
              {data[activeIndex].toFixed(1)}
            </Text>
            {labels?.[activeIndex] ? (
              <Text style={styles.readoutLabel}>{labels[activeIndex]}</Text>
            ) : null}
          </View>
        )}
      </View>

      {/* Touch-transparent: all gestures land on the wrapper above, so locationX
          is always measured in the same coordinate space. */}
      <View pointerEvents="none">
        <Svg width={width} height={height}>
          <Defs>
            <SvgGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.22} />
              <Stop offset="1" stopColor={color} stopOpacity={0.02} />
            </SvgGradient>
          </Defs>

          {/* Faint baseline so the wash has a floor to land on. */}
          <Line
            x1={0}
            y1={height - 0.5}
            x2={width}
            y2={height - 0.5}
            stroke={color}
            strokeOpacity={0.18}
            strokeWidth={1}
          />

          <AnimatedPath animatedProps={areaProps} fill="url(#trendFill)" />
          <AnimatedPath
            animatedProps={lineProps}
            stroke={color}
            strokeWidth={2.25}
            fill="none"
            strokeLinecap="round"
          />

          {/* Scrub indicator: hairline + dot snapped to the active morning. */}
          {active != null && (
            <>
              <Line
                x1={active.x}
                y1={PAD_TOP - 6}
                x2={active.x}
                y2={height - PAD_BOTTOM + 4}
                stroke={color}
                strokeOpacity={0.35}
                strokeWidth={1}
                strokeDasharray="2 3"
              />
              <Circle cx={active.x} cy={active.y} r={9} fill={color} fillOpacity={0.15} />
              <Circle cx={active.x} cy={active.y} r={4.5} fill={color} />
            </>
          )}

          {/* Today: a filled dot with a soft halo (hidden while scrubbing). */}
          {active == null && (
            <>
              <AnimatedCircle
                animatedProps={endDotProps}
                cx={endDot.x}
                r={9}
                fill={color}
                fillOpacity={0.15}
              />
              <AnimatedCircle animatedProps={endDotProps} cx={endDot.x} r={4} fill={color} />
            </>
          )}
        </Svg>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // A fixed lane above the canvas keeps layout stable whether or not the readout
  // is showing (no jump when scrubbing starts).
  readoutLane: {
    height: 40,
    justifyContent: 'flex-end',
    marginBottom: 2,
  },
  readout: {
    position: 'absolute',
    bottom: 0,
    width: 92,
    alignItems: 'center',
  },
  readoutValue: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 20,
  },
  readoutLabel: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 11,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: day.muted,
    marginTop: 1,
  },
})
