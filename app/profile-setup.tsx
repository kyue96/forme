import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSettings } from '@/lib/settings-context';
import { useUserStore } from '@/lib/user-store';
import ColorWheel from '@/components/ColorWheel';

const PRESET_COLORS = [
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#3B82F6', // Blue
  '#10B981', // Green
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#F97316', // Orange
];

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { theme } = useSettings();
  const { displayName, updateDisplayName, updateAvatarColor } = useUserStore();

  const [name, setName] = useState(displayName || '');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [showWheel, setShowWheel] = useState(false);

  const initial = name.trim().charAt(0).toUpperCase() || '?';

  const handleContinue = async () => {
    if (name.trim()) {
      await updateDisplayName(name.trim());
    }
    await updateAvatarColor(color);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center' }}>
        {/* Title */}
        <Text style={{ fontSize: 28, fontWeight: '800', color: theme.text, textAlign: 'center', marginBottom: 8 }}>
          Set up your profile
        </Text>
        <Text style={{ fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginBottom: 40 }}>
          Choose a name and pick your color
        </Text>

        {/* Avatar preview */}
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <View style={{
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: color,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 44, fontWeight: '800', color: '#FFFFFF' }}>
              {initial}
            </Text>
          </View>
        </View>

        {/* Name input */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Display Name
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="What should we call you?"
            placeholderTextColor={theme.chrome}
            autoCapitalize="words"
            autoCorrect={false}
            style={{
              backgroundColor: theme.surface,
              borderRadius: 14,
              paddingHorizontal: 16,
              paddingVertical: 14,
              fontSize: 16,
              color: theme.text,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          />
        </View>

        {/* Color picker */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            Your Color
          </Text>

          {showWheel ? (
            <View style={{ alignItems: 'center' }}>
              <ColorWheel
                size={200}
                currentColor={color}
                onColorSelect={setColor}
              />
              <Pressable onPress={() => setShowWheel(false)} style={{ marginTop: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.chrome }}>Back to presets</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
              {PRESET_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: c,
                    borderWidth: color === c ? 3 : 0,
                    borderColor: theme.text,
                  }}
                />
              ))}
              {/* Rainbow wheel button */}
              <Pressable
                onPress={() => setShowWheel(true)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  overflow: 'hidden',
                  borderWidth: showWheel ? 3 : 0,
                  borderColor: theme.text,
                }}
              >
                <View style={{
                  flex: 1,
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                }}>
                  {['#EF4444', '#F59E0B', '#10B981', '#3B82F6'].map((c, i) => (
                    <View key={i} style={{ width: 18, height: 18, backgroundColor: c }} />
                  ))}
                </View>
              </Pressable>
            </View>
          )}
        </View>
      </View>

      {/* Continue button */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
        <Pressable
          onPress={handleContinue}
          style={{
            backgroundColor: color,
            paddingVertical: 16,
            borderRadius: 16,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
            Continue
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
