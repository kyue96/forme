import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '@/lib/supabase';
import { usePlan } from '@/lib/plan-context';
import { useSettings } from '@/lib/settings-context';
import { AppHeader } from '@/components/AppHeader';

export default function ProfileScreen() {
  const router = useRouter();
  const { setPlan } = usePlan();
  const { theme, weightUnit } = useSettings();

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  // Progress stats
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [streak, setStreak] = useState(0);
  const [totalVolume, setTotalVolume] = useState(0);
  const [avgCalories, setAvgCalories] = useState<number | null>(null);

  // Pro card collapsed
  const [proExpanded, setProExpanded] = useState(false);

  useEffect(() => { loadUser(); }, []);

  useFocusEffect(useCallback(() => { loadStats(); }, []));

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setEmail(user.email ?? '');
      const name = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? '';
      setDisplayName(name);
      setNameInput(name);
    }
  };

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Workout logs
      const { data: logs } = await supabase
        .from('workout_logs')
        .select('completed_at, exercises, duration_minutes')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false });

      if (logs) {
        setTotalWorkouts(logs.length);

        // Streak: count consecutive days with workout ending today or yesterday
        const logDates = [...new Set(logs.map((l) => l.completed_at?.split('T')[0]).filter(Boolean))].sort().reverse();
        let s = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        for (let i = 0; i < logDates.length; i++) {
          const expected = new Date(today);
          expected.setDate(today.getDate() - i);
          if (logDates[i] === expected.toISOString().split('T')[0]) {
            s++;
          } else {
            break;
          }
        }
        setStreak(s);

        // Total volume
        let vol = 0;
        for (const log of logs) {
          if (!log.exercises) continue;
          for (const ex of log.exercises) {
            for (const set of ex.sets ?? []) {
              if (set.completed && set.weight != null) {
                vol += set.weight * (set.reps ?? 0);
              }
            }
          }
        }
        setTotalVolume(weightUnit === 'lbs' ? Math.round(vol * 2.205) : Math.round(vol));
      }

      // Avg calories (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data: meals } = await supabase
        .from('meals')
        .select('calories, date')
        .eq('user_id', user.id)
        .gte('date', sevenDaysAgo.toISOString().split('T')[0]);

      if (meals && meals.length > 0) {
        const byDay: Record<string, number> = {};
        for (const m of meals) {
          byDay[m.date] = (byDay[m.date] ?? 0) + (m.calories ?? 0);
        }
        const days = Object.values(byDay);
        setAvgCalories(Math.round(days.reduce((a, b) => a + b, 0) / days.length));
      }
    } catch {}
  };

  const saveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    try {
      await supabase.auth.updateUser({ data: { full_name: trimmed } });
      setDisplayName(trimmed);
      setEditingName(false);
    } catch {}
  };

  const handleSignOut = async () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          setPlan(null);
        },
      },
    ]);
  };

  const handleResetPlan = () => {
    Alert.alert('Reset plan', 'This will rebuild your workout plan from scratch.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          setPlan(null);
          router.push('/quiz/1');
        },
      },
    ]);
  };

  const formatVolume = (v: number): string => {
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return String(v);
  };

  const stats = [
    { label: 'Workouts', value: String(totalWorkouts), icon: 'barbell-outline' as const },
    { label: 'Streak', value: `${streak}d`, icon: 'flame-outline' as const },
    { label: `Vol (${weightUnit})`, value: formatVolume(totalVolume), icon: 'trending-up-outline' as const },
    { label: 'Avg cal', value: avgCalories != null ? String(avgCalories) : '—', icon: 'nutrition-outline' as const },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <AppHeader />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* User info */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20, alignItems: 'center' }}>
          <View style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: theme.surface,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12,
            borderWidth: 1,
            borderColor: theme.border,
          }}>
            <Ionicons name="person" size={32} color={theme.chrome} />
          </View>

          {editingName ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <TextInput
                style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: theme.text,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.chrome,
                  paddingBottom: 2,
                  minWidth: 120,
                  textAlign: 'center',
                }}
                value={nameInput}
                onChangeText={setNameInput}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={saveName}
              />
              <Pressable onPress={saveName}>
                <Ionicons name="checkmark-circle" size={22} color={theme.text} />
              </Pressable>
              <Pressable onPress={() => { setEditingName(false); setNameInput(displayName); }}>
                <Ionicons name="close-circle-outline" size={22} color={theme.chrome} />
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setEditingName(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Text allowFontScaling style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>
                {displayName}
              </Text>
              <Ionicons name="pencil-outline" size={14} color={theme.chrome} />
            </Pressable>
          )}

          <Text allowFontScaling style={{ fontSize: 13, color: theme.textSecondary }}>
            {email}
          </Text>
        </View>

        {/* Progress dashboard */}
        <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
          <Text allowFontScaling style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
            Progress
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {stats.map(({ label, value, icon }) => (
              <View
                key={label}
                style={{
                  width: '47%',
                  backgroundColor: theme.surface,
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <Ionicons name={icon} size={18} color={theme.chrome} style={{ marginBottom: 8 }} />
                <Text allowFontScaling style={{ fontSize: 24, fontWeight: '800', color: theme.text }}>
                  {value}
                </Text>
                <Text allowFontScaling style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Actions */}
        <View style={{ paddingHorizontal: 24, gap: 10, marginBottom: 24 }}>
          <Pressable
            onPress={handleResetPlan}
            style={{
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.border,
              paddingVertical: 16,
              paddingHorizontal: 20,
              borderRadius: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text allowFontScaling style={{ fontSize: 15, fontWeight: '600', color: theme.text }}>
              Rebuild my plan
            </Text>
            <Ionicons name="chevron-forward" size={18} color={theme.chrome} />
          </Pressable>

          <Pressable
            onPress={handleSignOut}
            style={{
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.border,
              paddingVertical: 16,
              paddingHorizontal: 20,
              borderRadius: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text allowFontScaling style={{ fontSize: 15, fontWeight: '600', color: '#EF4444' }}>
              Sign out
            </Text>
            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
          </Pressable>
        </View>

        {/* Go Pro card — collapsed by default */}
        <View style={{ paddingHorizontal: 24 }}>
          <Pressable
            onPress={() => setProExpanded(!proExpanded)}
            style={{
              backgroundColor: theme.text,
              borderRadius: 20,
              overflow: 'hidden',
            }}
          >
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingVertical: 16,
            }}>
              <View>
                <Text allowFontScaling style={{ fontSize: 16, fontWeight: '800', color: theme.background }}>
                  Forme Pro
                </Text>
                <Text allowFontScaling style={{ fontSize: 12, color: theme.background + '80', marginTop: 1 }}>
                  $9.99/month — unlock all features
                </Text>
              </View>
              <Ionicons
                name={proExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={theme.background + '80'}
              />
            </View>

            {proExpanded && (
              <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
                <View style={{ height: 1, backgroundColor: theme.background + '20', marginBottom: 14 }} />
                {[
                  'AI weight suggestions',
                  'Muscle recovery tracking',
                  'Pre-workout AI builder',
                  'Full workout history',
                  'Premium workout card templates',
                  'Meal AI suggestions',
                ].map((feature) => (
                  <View key={feature} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Ionicons name="checkmark-circle" size={15} color={theme.background + 'CC'} />
                    <Text allowFontScaling style={{ fontSize: 13, color: theme.background + 'CC', marginLeft: 8 }}>
                      {feature}
                    </Text>
                  </View>
                ))}
                <Pressable style={{
                  marginTop: 12,
                  backgroundColor: theme.background,
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                }}>
                  <Text allowFontScaling style={{ color: theme.text, fontWeight: '800', fontSize: 14 }}>
                    Upgrade to Pro
                  </Text>
                </Pressable>
              </View>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
