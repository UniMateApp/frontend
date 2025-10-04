import React from 'react'
import { View, TextInput, Text, StyleSheet, TextInputProps } from 'react-native'
import { FontAwesome } from '@expo/vector-icons'
import { Colors } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'

interface InputProps extends TextInputProps {
  label?: string
  leftIcon?: {
    type: 'font-awesome'
    name: string
  }
}

export function Input({ label, leftIcon, value, onChangeText, placeholder, secureTextEntry, ...rest }: InputProps) {
  const colorScheme = useColorScheme()
  const colors = Colors[colorScheme ?? 'light']

  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, { color: colors.text }]}>{label}</Text>}
      <View style={[styles.inputContainer, { borderColor: colors.cardBorder, backgroundColor: colors.card }]}>
        {leftIcon && (
          <FontAwesome
            name={leftIcon.name as any}
            size={18}
            color={colors.icon}
            style={styles.icon}
          />
        )}
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          secureTextEntry={secureTextEntry}
          {...rest}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  label: {
    fontSize: 14,
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
  },
})
