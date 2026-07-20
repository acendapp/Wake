import { Feather } from '@expo/vector-icons'
import { useState } from 'react'
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'

import { day } from '@/theme/colors'

type Props = {
  value: string
  onChangeText: (text: string) => void
  placeholder: string
  editable?: boolean
  /** New-password fields get the newPassword content type; false for sign-in. */
  isNew?: boolean
  /** The screen's own input style, so the field matches wherever it sits. */
  inputStyle?: StyleProp<TextStyle>
  containerStyle?: StyleProp<ViewStyle>
}

/**
 * A password field with a show/hide eye toggle. It wraps the host screen's input
 * style (passed via inputStyle) and reserves room on the right for the eye, so it
 * looks native to whatever screen uses it (onboarding, reset-password, …).
 */
export function PasswordInput({
  value,
  onChangeText,
  placeholder,
  editable = true,
  isNew = true,
  inputStyle,
  containerStyle,
}: Props) {
  const [visible, setVisible] = useState(false)
  return (
    <View style={[styles.wrap, containerStyle]}>
      <TextInput
        style={[inputStyle, styles.input]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={day.muted}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={isNew ? 'new-password' : 'current-password'}
        textContentType={isNew ? 'newPassword' : 'password'}
        editable={editable}
      />
      <Pressable
        style={styles.eye}
        onPress={() => setVisible((v) => !v)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
      >
        <Feather name={visible ? 'eye-off' : 'eye'} size={20} color={day.muted} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', justifyContent: 'center' },
  input: { paddingRight: 46 },
  eye: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
})
