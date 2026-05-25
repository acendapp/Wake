import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { generatePlan } from '@/engine/generatePlan'
import type { Plan } from '@/engine/types'

// Foundation preview: a hard-coded sample so we can see the engine render on
// device. The interactive morning flow (check-in → "reading the day" → Gap)
// replaces this next.
const SAMPLE = { readiness: 6, dayDifficulty: 8 }

const ACCENT: Record<Plan['accent'], { tint: string; label: string }> = {
  amber: { tint: '#B45309', label: 'Deficit' },
  neutral: { tint: '#475569', label: 'Aligned' },
  bright: { tint: '#0EA5E9', label: 'Surplus' },
}

export default function Index() {
  const plan = generatePlan(SAMPLE)
  const accent = ACCENT[plan.accent]
  const rest = plan.sequence.slice(1)

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>WAKE · ENGINE PREVIEW</Text>

        <View style={styles.gapRow}>
          <View style={styles.gapCell}>
            <Text style={styles.gapNumber}>{SAMPLE.readiness}</Text>
            <Text style={styles.gapLabel}>You</Text>
          </View>
          <Text style={styles.gapDivider}>/</Text>
          <View style={styles.gapCell}>
            <Text style={styles.gapNumber}>{SAMPLE.dayDifficulty}</Text>
            <Text style={styles.gapLabel}>Day</Text>
          </View>
          <View style={[styles.statePill, { backgroundColor: accent.tint }]}>
            <Text style={styles.statePillText}>{accent.label}</Text>
          </View>
        </View>

        <Text style={[styles.headline, { color: accent.tint }]}>{plan.headline}</Text>
        <Text style={styles.subhead}>{plan.subhead}</Text>

        <View style={[styles.oneThing, { borderColor: accent.tint }]}>
          <Text style={styles.oneThingLabel}>THE ONE THING</Text>
          <Text style={styles.oneThingTitle}>{plan.oneThing.title}</Text>
          <Text style={styles.oneThingDesc}>{plan.oneThing.description}</Text>
        </View>

        {rest.length > 0 && (
          <View style={styles.sequence}>
            <Text style={styles.sequenceLabel}>IF YOU'VE GOT THE BANDWIDTH</Text>
            {rest.map((action) => (
              <View key={action.slug} style={styles.seqItem}>
                <Text style={styles.seqTitle}>{action.title}</Text>
                <Text style={styles.seqDesc}>{action.description}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FBFAF8' },
  content: { padding: 24, gap: 16 },
  kicker: { fontSize: 12, letterSpacing: 2, color: '#94A3B8', fontWeight: '600' },
  gapRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 },
  gapCell: { alignItems: 'center' },
  gapNumber: { fontSize: 40, fontWeight: '700', color: '#0F172A', lineHeight: 44 },
  gapLabel: { fontSize: 12, color: '#94A3B8', letterSpacing: 1 },
  gapDivider: { fontSize: 28, color: '#CBD5E1', fontWeight: '300' },
  statePill: { marginLeft: 'auto', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  statePillText: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  headline: { fontSize: 24, fontWeight: '700', lineHeight: 30, marginTop: 4 },
  subhead: { fontSize: 16, color: '#64748B', lineHeight: 22 },
  oneThing: {
    borderWidth: 2,
    borderRadius: 18,
    padding: 18,
    gap: 6,
    backgroundColor: '#fff',
    marginTop: 8,
  },
  oneThingLabel: { fontSize: 11, letterSpacing: 1.5, color: '#94A3B8', fontWeight: '700' },
  oneThingTitle: { fontSize: 19, fontWeight: '700', color: '#0F172A', lineHeight: 25 },
  oneThingDesc: { fontSize: 15, color: '#64748B', lineHeight: 21 },
  sequence: { gap: 12, marginTop: 8 },
  sequenceLabel: { fontSize: 11, letterSpacing: 1.5, color: '#94A3B8', fontWeight: '700' },
  seqItem: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: '#EEF0F2',
  },
  seqTitle: { fontSize: 16, fontWeight: '600', color: '#0F172A', lineHeight: 21 },
  seqDesc: { fontSize: 14, color: '#94A3B8', lineHeight: 19 },
})
