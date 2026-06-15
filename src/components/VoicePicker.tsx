import { Feather } from '@expo/vector-icons'
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio'
import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { VOICES, type Voice } from '@/lib/alarmCore'
import { VOICE_PREVIEW_CLIP } from '@/lib/wakeAudio'
import { day } from '@/theme/colors'

// The wake-alarm voice picker — grouped Women/Men cards, each with a play/pause
// preview. Self-contained audio: one reused player so clips never overlap, the
// playing card shows a pause icon, and it reverts when the clip ends or another
// is tapped. Used by both the Settings screen and onboarding.

type Props = {
  value: string
  onChange: (voiceId: string) => void
}

export function VoicePicker({ value, onChange }: Props) {
  const playerRef = useRef<AudioPlayer | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {})
    return () => {
      playerRef.current?.remove()
      playerRef.current = null
    }
  }, [])

  const stop = () => {
    playerRef.current?.remove()
    playerRef.current = null
    setPlaying(null)
  }

  const preview = (voiceId: string) => {
    if (playing === voiceId) {
      stop()
      return
    }
    const src = VOICE_PREVIEW_CLIP[voiceId]
    if (!src) return
    try {
      playerRef.current?.remove()
      const player = createAudioPlayer(src)
      playerRef.current = player
      player.addListener('playbackStatusUpdate', (status) => {
        if (status?.didJustFinish && playerRef.current === player) stop()
      })
      player.play()
      setPlaying(voiceId)
    } catch {
      stop()
    }
  }

  const group = (gender: Voice['gender']) =>
    VOICES.filter((v) => v.gender === gender).map((v) => (
      <VoiceCard
        key={v.id}
        voice={v}
        selected={value === v.id}
        playing={playing === v.id}
        onPress={() => onChange(v.id)}
        onPreview={() => preview(v.id)}
      />
    ))

  return (
    <View>
      <Text style={styles.groupLabel}>Women</Text>
      <View style={styles.list}>{group('female')}</View>
      <Text style={[styles.groupLabel, styles.groupLabelGap]}>Men</Text>
      <View style={styles.list}>{group('male')}</View>
    </View>
  )
}

function VoiceCard({
  voice,
  selected,
  playing,
  onPress,
  onPreview,
}: {
  voice: Voice
  selected: boolean
  playing: boolean
  onPress: () => void
  onPreview: () => void
}) {
  return (
    <Pressable
      style={[styles.card, selected && styles.cardOn]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${voice.name}. ${voice.tagline}`}
    >
      <Pressable
        style={[styles.previewBtn, playing && styles.previewBtnOn]}
        onPress={onPreview}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`${playing ? 'Stop' : 'Preview'} ${voice.name}`}
      >
        <Feather name={playing ? 'pause' : 'play'} size={14} color={playing ? day.onAccent : day.gold} />
      </Pressable>
      <View style={styles.text}>
        <Text style={[styles.name, selected && styles.nameOn]}>{voice.name}</Text>
        <Text style={styles.tagline}>{voice.tagline}</Text>
      </View>
      {selected && <Feather name="check" size={20} color={day.gold} />}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  groupLabel: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 14,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: day.muted,
    marginBottom: 12,
  },
  groupLabelGap: {
    marginTop: 24,
  },
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
  previewBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: day.goldTint,
    marginRight: 14,
    paddingLeft: 2, // optically center the play triangle
  },
  previewBtnOn: {
    backgroundColor: day.gold,
    paddingLeft: 0,
  },
  text: {
    flex: 1,
    gap: 3,
    marginRight: 12,
  },
  name: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 17,
    color: day.text,
  },
  nameOn: {
    color: day.gold,
  },
  tagline: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14,
    lineHeight: 19,
    color: day.muted,
  },
})
