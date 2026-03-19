import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import { useSettings } from '@/lib/settings-context';
import type { RestTimerDuration } from '@/lib/settings-context';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/lib/user-store';
import { searchGyms, GymResult } from '@/lib/gym-search';
import { isNudgeEnabled, setNudgeEnabled } from '@/lib/nudge-service';

export default function SettingsScreen() {
  const router = useRouter();
  const {
    theme, themeMode, setThemeMode,
    weightUnit, setWeightUnit,
    warmupEnabled, setWarmupEnabled,
    restTimerEnabled, setRestTimerEnabled,
    restTimerDuration, setRestTimerDuration,
  } = useSettings();

  const { gymName, updateGym } = useUserStore();
  const [email, setEmail] = useState('');
  const [notifStatus, setNotifStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [cameraStatus, setCameraStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [nudgesOn, setNudgesOn] = useState(true);
  const [gymQuery, setGymQuery] = useState('');
  const [gymResults, setGymResults] = useState<GymResult[]>([]);
  const [gymSearching, setGymSearching] = useState(false);

  const REST_OPTIONS: RestTimerDuration[] = [30, 45, 60, 90, 120];

  useEffect(() => {
    loadEmail();
    checkNotifPermission();
    checkCameraPermission();
    isNudgeEnabled().then(setNudgesOn);
  }, []);

  const loadEmail = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) setEmail(user.email);
  };

  const checkNotifPermission = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setNotifStatus(status as 'granted' | 'denied' | 'undetermined');
  };

  const requestNotifPermission = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status === 'denied') {
      Linking.openSettings();
    } else {
      setNotifStatus(status as 'granted' | 'denied' | 'undetermined');
    }
  };

  const checkCameraPermission = async () => {
    const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
    setCameraStatus(status as 'granted' | 'denied' | 'undetermined');
  };

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status === 'denied') {
      Linking.openSettings();
    } else {
      setCameraStatus(status as 'granted' | 'denied' | 'undetermined');
    }
  };

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
            label="Warm-up"
            right={
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {([true, false] as const).map(v => (
                  <Pressable
                    key={String(v)}
                    onPress={() => setWarmupEnabled(v)}
                    style={{ paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: warmupEnabled === v ? theme.text : theme.chromeLight }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: warmupEnabled === v ? theme.background : theme.textSecondary }}>{v ? 'On' : 'Off'}</Text>
                  </Pressable>
                ))}
              </View>
            }
          />
          <RowItem
            label="Rest timer"
            right={
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {([true, false] as const).map(v => (
                  <Pressable
                    key={String(v)}
                    onPress={() => setRestTimerEnabled(v)}
                    style={{ paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: restTimerEnabled === v ? theme.text : theme.chromeLight }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: restTimerEnabled === v ? theme.background : theme.textSecondary }}>{v ? 'On' : 'Off'}</Text>
                  </Pressable>
                ))}
              </View>
            }
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

        {/* Notifications */}
        <SectionHeader title="Notifications" />
        <View style={{ borderTopWidth: 1, borderTopColor: theme.border }}>
          <View style={{ paddingHorizontal: 20, paddingVertical: 14, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 15, color: theme.text }}>Permission</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: notifStatus === 'granted' ? '#22C55E' : '#EF4444' }} />
                <Text style={{ fontSize: 13, color: theme.textSecondary }}>
                  {notifStatus === 'granted' ? 'Granted' : notifStatus === 'denied' ? 'Denied' : 'Not set'}
                </Text>
              </View>
            </View>
            {notifStatus !== 'granted' && (
              <Pressable
                onPress={requestNotifPermission}
                style={{ marginTop: 10, backgroundColor: theme.text, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}
              >
                <Text style={{ color: theme.background, fontWeight: '600', fontSize: 13 }}>Enable Notifications</Text>
              </Pressable>
            )}
          </View>
          {notifStatus === 'granted' && (
            <>
              <RowItem
                label="Workout reminders"
                right={<Ionicons name="checkmark-circle" size={20} color="#22C55E" />}
              />
              <RowItem
                label="Meal reminders"
                right={<Ionicons name="checkmark-circle" size={20} color="#22C55E" />}
              />
            </>
          )}
        </View>

        {/* Camera & Photos */}
        <SectionHeader title="Camera & Photos" />
        <View style={{ borderTopWidth: 1, borderTopColor: theme.border }}>
          <View style={{ paddingHorizontal: 20, paddingVertical: 14, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 15, color: theme.text }}>Photo library</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cameraStatus === 'granted' ? '#22C55E' : '#EF4444' }} />
                <Text style={{ fontSize: 13, color: theme.textSecondary }}>
                  {cameraStatus === 'granted' ? 'Granted' : cameraStatus === 'denied' ? 'Denied' : 'Not set'}
                </Text>
              </View>
            </View>
            {cameraStatus !== 'granted' && (
              <Pressable
                onPress={requestCameraPermission}
                style={{ marginTop: 10, backgroundColor: theme.text, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}
              >
                <Text style={{ color: theme.background, fontWeight: '600', fontSize: 13 }}>Enable Camera Access</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Nudges */}
        <SectionHeader title="Nudges" />
        <View style={{ borderTopWidth: 1, borderTopColor: theme.border }}>
          <RowItem
            label="Workout reminders"
            right={
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {([true, false] as const).map(v => (
                  <Pressable
                    key={String(v)}
                    onPress={() => { setNudgesOn(v); setNudgeEnabled(v); }}
                    style={{ paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: nudgesOn === v ? theme.text : theme.chromeLight }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: nudgesOn === v ? theme.background : theme.textSecondary }}>{v ? 'On' : 'Off'}</Text>
                  </Pressable>
                ))}
              </View>
            }
          />
        </View>

        {/* Gym */}
        <SectionHeader title="Your Gym (optional)" />
        <View style={{ borderTopWidth: 1, borderTopColor: theme.border }}>
          <View style={{ paddingHorizontal: 20, paddingVertical: 14, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border }}>
            {gymName ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <Ionicons name="location" size={18} color={theme.chrome} />
                  <Text style={{ fontSize: 15, color: theme.text, flex: 1 }} numberOfLines={1}>{gymName}</Text>
                </View>
                <Pressable onPress={() => updateGym(null, null)} hitSlop={8}>
                  <Text style={{ fontSize: 13, color: theme.chrome }}>Remove</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TextInput
                    style={{ flex: 1, fontSize: 15, color: theme.text, backgroundColor: theme.background, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: theme.border }}
                    placeholder="Search for your gym..."
                    placeholderTextColor={theme.textSecondary}
                    value={gymQuery}
                    onChangeText={setGymQuery}
                    returnKeyType="search"
                    onSubmitEditing={async () => {
                      if (!gymQuery.trim()) return;
                      setGymSearching(true);
                      const results = await searchGyms(gymQuery);
                      setGymResults(results);
                      setGymSearching(false);
                    }}
                  />
                </View>
                {gymSearching && <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 8 }}>Searching...</Text>}
                {gymResults.map((g) => (
                  <Pressable
                    key={g.placeId}
                    onPress={() => {
                      updateGym(g.name, g.placeId);
                      setGymQuery('');
                      setGymResults([]);
                    }}
                    style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>{g.name}</Text>
                    <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>{g.address}</Text>
                  </Pressable>
                ))}
              </>
            )}
          </View>
        </View>

        {/* Account */}
        <SectionHeader title="Account" />
        <View style={{ borderTopWidth: 1, borderTopColor: theme.border }}>
          <View style={{ paddingHorizontal: 20, paddingVertical: 14, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border }}>
            <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 2 }}>Logged in as</Text>
            <Text style={{ fontSize: 15, color: theme.text }}>{email || 'Loading…'}</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
