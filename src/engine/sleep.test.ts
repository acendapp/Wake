import { describe, expect, it } from 'vitest'
import { recommendSleep } from './sleep'

describe('recommendSleep', () => {
  it('targets ~7h for a light day and ~8.5h for a relentless one', () => {
    expect(recommendSleep(1, '06:30').targetHours).toBe(7)
    expect(recommendSleep(10, '06:30').targetHours).toBe(8.5)
  })

  it('scales monotonically with demand', () => {
    const hours = [1, 3, 5, 7, 10].map((d) => recommendSleep(d, '06:30').targetHours)
    for (let i = 1; i < hours.length; i++) {
      expect(hours[i]).toBeGreaterThanOrEqual(hours[i - 1])
    }
  })

  it('rounds the target to a quarter-hour', () => {
    for (let d = 1; d <= 10; d++) {
      const { targetHours } = recommendSleep(d, '06:30')
      expect((targetHours * 4) % 1).toBe(0)
    }
  })

  it('computes a bedtime that precedes wake by the target', () => {
    // 8.5h before 06:30 = 22:00 the night before.
    expect(recommendSleep(10, '06:30').bedtime).toBe('22:00')
    // 7h before 07:00 = 00:00 (midnight).
    expect(recommendSleep(1, '07:00').bedtime).toBe('00:00')
  })

  it('wraps bedtimes that fall after midnight', () => {
    // 7h before 05:00 = 22:00 prior evening.
    expect(recommendSleep(1, '05:00').bedtime).toBe('22:00')
  })

  it('clamps out-of-range demand', () => {
    expect(recommendSleep(99, '06:30').targetHours).toBe(8.5)
    expect(recommendSleep(-4, '06:30').targetHours).toBe(7)
  })

  it('keeps the wake time it was given', () => {
    expect(recommendSleep(6, '06:45').wakeTime).toBe('06:45')
  })
})
