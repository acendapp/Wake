import { Feather } from '@expo/vector-icons'
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { VOICES, type Voice } from '@/lib/alarmCore'
import { day } from '@/theme/colors'

// The wake-alarm voice picker — a list of voices by name, each with a tap-to-hear
// preview button. Used by the Settings screen and onboarding.

// One bundled preview recording per voice. Static require()s — Metro can't resolve
// a dynamic asset path — so add an entry as each voice's clips land. Only voices
// listed here show a preview button.
const PREVIEW: Record<string, number> = {
  maria: require('../../assets/audio/maria-01.caf'),
  rowan: require('../../assets/audio/rowan-01.caf'),
  verity: require('../../assets/audio/verity-01.caf'),
  marcus: require('../../assets/audio/marcus-01.caf'),
}

type Props = {
  value: string
  onChange: (voiceId: string) => void
}

export function VoicePicker({ value, onChange }: Props) {
  const player = useAudioPlayer()
  const status = useAudioPlayerStatus(player)
  const [previewingId, setPreviewingId] = useState<string | null>(null)

  // Let the preview be heard even when the phone is on silent — the user tapped it
  // on purpose. Best-effort.
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {})
  }, [])

  // Clear the playing state when a clip finishes on its own.
  useEffect(() => {
    if (status.didJustFinish) setPreviewingId(null)
  }, [status.didJustFinish])

  const togglePreview = (id: string) => {
    const src = PREVIEW[id]
    if (!src) return
    // Tapping the one that's playing stops it; otherwise (re)start from the top.
    if (previewingId === id && status.playing) {
      player.pause()
      setPreviewingId(null)
      return
    }
    player.replace(src)
    void player.seekTo(0)
    player.play()
    setPreviewingId(id)
  }

  return (
    <View style={styles.list}>
      {VOICES.map((v) => (
        <VoiceCard
          key={v.id}
          voice={v}
          selected={value === v.id}
          canPreview={!!PREVIEW[v.id]}
          previewing={previewingId === v.id && status.playing}
          onPress={() => onChange(v.id)}
          onPreview={() => togglePreview(v.id)}
        />
      ))}
    </View>
  )
}

function VoiceCard({
  voice,
  selected,
  canPreview,
  previewing,
  onPress,
  onPreview,
}: {
  voice: Voice
  selected: boolean
  canPreview: boolean
  previewing: boolean
  onPress: () => void
  onPreview: () => void
}) {
  return (
    <Pressable
      style={[styles.card, selected && styles.cardOn]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={voice.name}
    >
      <View style={styles.left}>
        {canPreview ? (
          <Pressable
            onPress={onPreview}
            hitSlop={12}
            style={[styles.previewBtn, previewing && styles.previewBtnOn]}
            accessibilityRole="button"
            accessibilityLabel={previewing ? `Stop preview of ${voice.name}` : `Hear ${voice.name}`}
          >
            <Feather
              name={previewing ? 'pause' : 'play'}
              size={15}
              color={previewing ? day.onAccent : day.gold}
            />
          </Pressable>
        ) : null}
        <Text style={[styles.name, selected && styles.nameOn]}>{voice.name}</Text>
      </View>
      {selected ? <Feather name="check" size={20} color={day.gold} /> : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: day.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  cardOn: {
    borderColor: day.gold,
    borderWidth: 1.5,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  previewBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: day.goldTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.gold,
  },
  previewBtnOn: {
    backgroundColor: day.gold,
  },
  name: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 17,
    color: day.text,
  },
  nameOn: {
    color: day.gold,
  },
})
