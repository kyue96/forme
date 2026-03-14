import { useState } from 'react';
import {
  Modal,
  Pressable,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '@/lib/settings-context';
import type { RestTimerDuration } from '@/lib/settings-context';

export function AppHeader() {
  const {
    theme, themeMode, setThemeMode,
    weightUnit, setWeightUnit,
    restTimerEnabled, setRestTimerEnabled,
    restTimerDuration, setRestTimerDuration,
  } = useSettings();

  const [sheetOpen, setSheetOpen] = useState(false);

  const REST_OPTIONS: RestTimerDuration[] = [30, 60, 90, 120];

  return (
    <>
      {/* Header bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 14,
          backgroundColor: theme.background,
          borderBottomWidth: 1,
          borderBottomColor: '#C0C0C0',
        }}
      >
        <Text
          allowFontScaling
          style={{
            fontSize: 18,
            fontWeight: '800',
            letterSpacing: 3,
            color: theme.text,
            textTransform: 'uppercase',
          }}
        >
          FORME
        </Text>
        <Pressable
          onPress={() => setSheetOpen(true)}
          style={{ padding: 4 }}
          hitSlop={12}
        >
          <Ionicons name="settings-outline" size={22} color={theme.chrome} />
        </Pressable>
      </View>

      {/* Settings bottom sheet */}
      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
          onPress={() => setSheetOpen(false)}
        />
        <View
          style={{
            backgroundColor: theme.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 24,
            paddingTop: 20,
            paddingBottom: 48,
          }}
        >
          {/* Handle */}
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: theme.chrome,
              alignSelf: 'center',
              marginBottom: 20,
            }}
          />

          <Text
            allowFontScaling
            style={{
              fontSize: 16,
              fontWeight: '700',
              color: theme.text,
              marginBottom: 20,
              letterSpacing: 0.5,
            }}
          >
            Settings
          </Text>

          {/* Weight unit */}
          <View style={{ marginBottom: 20 }}>
            <Text allowFontScaling style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
              Weight unit
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {(['kg', 'lbs'] as const).map((u) => (
                <Pressable
                  key={u}
                  onPress={() => setWeightUnit(u)}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                    backgroundColor: weightUnit === u ? theme.text : theme.chromeLight,
                  }}
                >
                  <Text
                    allowFontScaling
                    style={{
                      fontWeight: '600',
                      color: weightUnit === u ? theme.background : theme.textSecondary,
                    }}
                  >
                    {u.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Rest timer default */}
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text allowFontScaling style={{ fontSize: 12, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>
                Rest timer
              </Text>
              <Switch
                value={restTimerEnabled}
                onValueChange={setRestTimerEnabled}
                trackColor={{ false: theme.chromeLight, true: theme.chrome }}
                thumbColor={theme.white}
              />
            </View>
            {restTimerEnabled && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {REST_OPTIONS.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => setRestTimerDuration(s)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      alignItems: 'center',
                      backgroundColor: restTimerDuration === s ? theme.text : theme.chromeLight,
                    }}
                  >
                    <Text
                      allowFontScaling
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: restTimerDuration === s ? theme.background : theme.textSecondary,
                      }}
                    >
                      {s}s
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Dark / light mode */}
          <View style={{ marginBottom: 4 }}>
            <Text allowFontScaling style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
              Appearance
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {(['dark', 'light'] as const).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setThemeMode(m)}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                    backgroundColor: themeMode === m ? theme.text : theme.chromeLight,
                  }}
                >
                  <Text
                    allowFontScaling
                    style={{
                      fontWeight: '600',
                      textTransform: 'capitalize',
                      color: themeMode === m ? theme.background : theme.textSecondary,
                    }}
                  >
                    {m}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
