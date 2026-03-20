import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';
import { usePlan } from '@/lib/plan-context';
import { LoggedExercise } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import { MuscleGroupPills } from '@/components/MuscleGroupPills';
import { getExerciseCategories } from '@/lib/exercise-utils';
import { dateKey } from '@/components/WeeklyCalendar';
import { useUserStore } from '@/lib/user-store';

export default function DayViewScreen() {
  const router = useRouter();
  const { weightUnit, theme } = useSettings();
  const { plan } = usePlan();
  const { avatarColor } = useUserStore();
  const params = useLocalSearchParams<{ dateStr: string; dayName: string }>();
  const focusCardColor = avatarColor || '#F59E0B';

  const [log, setLog] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const dateStr = params.dateStr ?? '';
  const dayName = params.dayName ?? '';

  const planned = plan?.weeklyPlan.find(
    (d) => d.dayName.toLowerCase() === dayName.toLowerCase()
  );

  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const todayStr = dateKey(todayMidnight);
  const isToday = dateStr === todayStr;

  // Format date for header
  const dateObj = new Date(dateStr + 'T12:00:00');
  const dateLabel = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  useEffect(() => {
    fetchLog();
  }, [dateStr]);

  const fetchLog = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: logs } = await supabase
        .from('workout_logs')
        .select('id, day_name, exercises, duration_minutes, completed_at')
        .eq('user_id', user.id)
        .gte('completed_at', dateStr + 'T00:00:00')
        .lte('completed_at', dateStr + 'T23:59:59')
        .limit(1);
      setLog(logs?.[0] ?? null);
    } catch {
      setLog(null);
    } finally {
      setLoading(false);
    }
  };

  // Computed stats for logged workout
  const exercises: LoggedExercise[] = log?.exercises ?? [];
  const totalSets = exercises.reduce((s, ex) => s + ex.sets.filter((se) => se.completed).length, 0);
  const totalReps = exercises.reduce(
    (s, ex) => s + ex.sets.filter((se) => se.completed).reduce((r, set) => r + set.reps, 0), 0
  );
  const volumeRaw = exercises.reduce(
    (s, ex) => s + ex.sets.filter((se) => se.completed && se.weight != null).reduce((v, set) => v + (set.weight ?? 0) * set.reps, 0), 0
  );
  const volume = weightUnit === 'lbs' ? Math.round(volumeRaw * 2.205) : Math.round(volumeRaw);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: theme.background,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ padding: 4, marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>{dateLabel}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.chrome} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Workout Complete card (shown when a workout was logged) */}
          {log && (
            <Pressable
              onPress={() => router.push({
                pathname: '/workout/session-view',
                params: {
                  exercises: JSON.stringify(exercises),
                  dayName: log.day_name ?? '',
                  focus: log.day_name ?? '',
                  durationMinutes: String(log.duration_minutes ?? 0),
                  completedAt: log.completed_at ?? '',
                  logId: log.id ?? '',
                },
              })}
              style={{ backgroundColor: focusCardColor, borderRadius: 24, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: focusCardColor, marginBottom: 12 }}
            >
              <Text style={{ position: 'absolute', top: 14, right: 16, fontSize: 11, fontWeight: '700', color: '#FFFFFFAA', letterSpacing: 1 }}>VIEW</Text>
              <Ionicons name="checkmark-circle" size={48} color="#FFFFFF" />
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginTop: 12 }}>
                Workout Complete
              </Text>
            </Pressable>
          )}

          {/* Shareable workout card (shown when a workout was logged) */}
          {log && (
            <Pressable
              onPress={() => router.push({
                pathname: '/workout/post-workout',
                params: {
                  exercises: JSON.stringify(exercises),
                  dayName: log.day_name ?? '',
                  focus: log.day_name ?? '',
                  durationMinutes: String(log.duration_minutes ?? 0),
                },
              })}
            >
              <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border, marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{log.day_name ?? 'Workout'}</Text>
                  <MuscleGroupPills categories={getExerciseCategories(exercises)} size="small" />
                </View>
                <View style={{ alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ fontSize: 32, fontWeight: '800', color: theme.text, lineHeight: 36 }}>
                    {volume > 0 ? formatNumber(volume) : '\u2014'}
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>{weightUnit === 'lbs' ? 'pounds' : 'kg'} moved</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 10 }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>{totalSets}</Text>
                    <Text style={{ fontSize: 10, fontWeight: '500', color: theme.text, opacity: 0.5 }}>sets</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>{totalReps}</Text>
                    <Text style={{ fontSize: 10, fontWeight: '500', color: theme.text, opacity: 0.5 }}>reps</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>{log.duration_minutes ?? 0}m</Text>
                    <Text style={{ fontSize: 10, fontWeight: '500', color: theme.text, opacity: 0.5 }}>time</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          )}

          {/* Exercise list for logged workout */}
          {log && exercises.length > 0 && (
            <View style={{ gap: 6, marginBottom: 16 }}>
              {exercises.map((ex, i) => {
                const sets = ex.sets?.length ?? 0;
                return (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 12 }}>
                    <Text style={{ fontSize: 13, color: theme.text, fontWeight: '600', flex: 1 }}>
                      {`\u2022 ${ex.name}`}
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.chrome }}>{sets} sets</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Planned workout (only if no logged workout) */}
          {!log && planned && (
            <View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text, marginBottom: 8 }}>{planned.focus}</Text>
              <View style={{ marginBottom: 12 }}>
                <MuscleGroupPills categories={getExerciseCategories(planned.exercises)} size="small" />
              </View>
              {planned.exercises.length > 0 && (
                <View style={{ gap: 6 }}>
                  {planned.exercises.map((ex, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 12 }}>
                      <Text style={{ fontSize: 13, color: theme.text, fontWeight: '600', flex: 1 }}>
                        {`\u2022 ${ex.name}`}
                      </Text>
                      {ex.sets > 0 && <Text style={{ fontSize: 11, color: theme.chrome }}>{ex.sets} sets</Text>}
                    </View>
                  ))}
                </View>
              )}
              {isToday && (
                <Pressable
                  onPress={() => {
                    const idx = plan?.weeklyPlan.indexOf(planned);
                    if (idx != null && idx >= 0) router.push(`/workout/${idx}`);
                  }}
                  style={{ backgroundColor: theme.text, paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 16 }}
                >
                  <Text style={{ color: theme.background, fontWeight: '700' }}>Start workout →</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Rest day — no log and no plan */}
          {!log && !planned && (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Text style={{ fontSize: 15, color: theme.textSecondary }}>No workout logged or planned for this day.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
