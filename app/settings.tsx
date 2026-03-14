import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '@/lib/settings-context';
import type { RestTimerDuration } from '@/lib/settings-context';

export default function SettingsScreen() {
  const router = useRouter();
  const {
    theme, themeMode, setThemeMode,
    weightUnit, setWeightUnit,
    restTimerEnabled, setRestTimerEnabled,
    restTimerDuration, setRestTimerDuration,
  } = useSettings();

  const REST_OPTIONS: RestTimerDuration[] = [30, 60, 90, 120];

  const SectionHeader = ({ title }: { title: string }) => (
    <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1.5, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 }}>
      {title}
    </Text>
  );

  const RowItem = ({ label, right }: { label: string; right: React.ReactNode }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border }}>
      <Text style={{ fontSize: 15, color: theme.text }}>{label}</Text>
      {right}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.background }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 16 }} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </Pressable>
        <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text }}>Settings</Text>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Preferences */}
        <SectionHeader title="Preferences" />
        <View style={{ borderTopWidth: 1, borderTopColor: theme.border }}>
          <RowItem
            label="Weight unit"
            right={
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['kg', 'lbs'] as const).map(u => (
                  <Pressable
                    key={u}
                    onPress={() => setWeightUnit(u)}
                    style={{ paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: weightUnit === u ? theme.text : theme.chromeLight }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: weightUnit === u ? theme.background : theme.textSecondary }}>{u.toUpperCase()}</Text>
                  </Pressable>
                ))}
              </View>
            }
          />
          <RowItem
            label="Rest timer"
            right={<Switch value={restTimerEnabled} onValueChange={setRestTimerEnabled} trackColor={{ false: theme.border, true: '#22C55E' }} thumbColor={theme.white} />}
          />
          {restTimerEnabled && (
            <View style={{ paddingHorizontal: 20, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border }}>
              <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 10 }}>Timer duration</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {REST_OPTIONS.map(s => (
                  <Pressable
                    key={s}
                    onPress={() => setRestTimerDuration(s)}
                    style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: restTimerDuration === s ? theme.text : theme.chromeLight }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: restTimerDuration === s ? theme.background : theme.textSecondary }}>{s}s</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          <RowItem
            label="Appearance"
            right={
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['light', 'dark'] as const).map(m => (
                  <Pressable
                    key={m}
                    onPress={() => setThemeMode(m)}
                    style={{ paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: themeMode === m ? theme.text : theme.chromeLight }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: themeMode === m ? theme.background : theme.textSecondary, textTransform: 'capitalize' }}>{m}</Text>
                  </Pressable>
                ))}
              </View>
            }
          />
        </View>

        {/* Account */}
        <SectionHeader title="Account" />
        <View style={{ borderTopWidth: 1, borderTopColor: theme.border }}>
          <View style={{ paddingHorizontal: 20, paddingVertical: 14, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border }}>
            <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 2 }}>Logged in as</Text>
            <Text style={{ fontSize: 15, color: theme.text }}>Loading…</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
