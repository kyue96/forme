import { useEffect, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';

import { useSettings } from '@/lib/settings-context';
import { LoggedExercise } from '@/lib/types';
import { EXERCISE_DATABASE } from '@/lib/exercise-data';
import { formatNumber } from '@/lib/utils';
import {
  computeTotalVolume,
  computeTopE1RMs,
  computeVolumeByMuscle,
  computeDensity,
  computeAvgIntensity,
  formatVolumeHeadline,
  formatDensity,
  formatIntensity,
  getIntensityZone,
} from '@/lib/workout-metrics';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getMusclesWorked(exercises: LoggedExercise[]): string[] {
  const muscles = new Set<string>();
  for (const ex of exercises) {
    const match = EXERCISE_DATABASE.find(
      (e) => e.name.toLowerCase() === ex.name.toLowerCase()
    );
    if (match) muscles.add(match.category);
    else {
      const lower = ex.name.toLowerCase();
      if (lower.includes('bench') || lower.includes('chest') || lower.includes('push') || lower.includes('fly')) muscles.add('Chest');
      else if (lower.includes('row') || lower.includes('pull') || lower.includes('lat') || lower.includes('deadlift')) muscles.add('Back');
      else if (lower.includes('squat') || lower.includes('leg') || lower.includes('lunge') || lower.includes('calf') || lower.includes('hip')) muscles.add('Legs');
      else if (lower.includes('shoulder') || lower.includes('press') || lower.includes('raise') || lower.includes('delt')) muscles.add('Shoulders');
      else if (lower.includes('curl') || lower.includes('tricep') || lower.includes('bicep')) muscles.add('Arms');
      else if (lower.includes('plank') || lower.includes('crunch') || lower.includes('ab') || lower.includes('core')) muscles.add('Core');
    }
  }
  return Array.from(muscles);
}

export default function PostWorkoutScreen() {
  const router = useRouter();
  const { weightUnit, theme } = useSettings();
  const params = useLocalSearchParams<{
    exercises: string;
    dayName: string;
    focus: string;
    durationMinutes: string;
  }>();

  const notificationSent = useRef(false);

  const exercises: LoggedExercise[] = params.exercises ? JSON.parse(params.exercises) : [];
  const durationMinutes = parseInt(params.durationMinutes ?? '0', 10);

  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.filter((s) => s.completed).length, 0);
  const totalReps = exercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.completed).reduce((r, set) => r + set.reps, 0),
    0
  );
  const totalVolume = exercises.reduce(
    (sum, ex) =>
      sum + ex.sets.filter((s) => s.completed && s.weight != null)
        .reduce((s, set) => s + (set.weight ?? 0) * set.reps, 0),
    0
  );
  const displayVolume = weightUnit === 'lbs' ? Math.round(totalVolume * 2.205) : totalVolume;
  const unitLabel = weightUnit === 'lbs' ? 'lbs' : 'kg';
  const musclesWorked = getMusclesWorked(exercises);

  // Advanced metrics
  const topE1RMs = computeTopE1RMs(exercises, 3);
  const volumeByMuscle = computeVolumeByMuscle(exercises);
  const density = computeDensity(exercises, durationMinutes);
  const avgIntensity = computeAvgIntensity(exercises);
  const intensityZone = getIntensityZone(avgIntensity);

  useEffect(() => {
    if (!notificationSent.current) {
      notificationSent.current = true;
      sendNotification();
    }
  }, []);

  const sendNotification = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;
      await Notifications.scheduleNotificationAsync({
        content: { title: 'Great workout!', body: 'Time to refuel \u2014 log your meal.' },
        trigger: null,
      });
    } catch {}
  };

  const formatDuration = (mins: number): string => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      {/* Header with back button */}
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
        <Text style={{ fontSize: 17, fontWeight: '800', letterSpacing: 3, color: theme.text, textTransform: 'uppercase' }}>
          FORME
        </Text>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: theme.text, marginBottom: 4 }}>Workout complete</Text>
          <Text style={{ fontSize: 14, color: theme.textSecondary }}>{params.focus} · {params.dayName}</Text>
        </View>

        {/* Summary metrics */}
        <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 26, fontWeight: '700', color: theme.text }}>{totalSets}</Text>
              <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}>Sets</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 26, fontWeight: '700', color: theme.text }}>{totalReps}</Text>
              <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}>Reps</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 26, fontWeight: '700', color: theme.text }}>{formatNumber(displayVolume)}</Text>
              <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}>{unitLabel} Moved</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
            <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 26, fontWeight: '700', color: theme.text }}>{formatDuration(durationMinutes)}</Text>
              <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}>Time</Text>
            </View>
          </View>
          {musclesWorked.length > 0 && (
            <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginTop: 12 }}>
              <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 8 }}>Muscles Worked</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {musclesWorked.map((m) => (
                  <View key={m} style={{ backgroundColor: theme.background, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: theme.border }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>{m}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Volume headline */}
          {displayVolume > 0 && (
            <View style={{ backgroundColor: theme.text, borderRadius: 16, padding: 16, marginTop: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: theme.background, textAlign: 'center' }}>
                {formatVolumeHeadline(displayVolume, unitLabel)}
              </Text>
            </View>
          )}

          {/* Density + Intensity row */}
          {(density > 0 || avgIntensity > 0) && (
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              {density > 0 && (
                <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 16, alignItems: 'center' }}>
                  <Ionicons name="flash-outline" size={20} color={theme.chrome} style={{ marginBottom: 6 }} />
                  <Text style={{ fontSize: 20, fontWeight: '700', color: theme.text }}>{formatDensity(density, unitLabel)}</Text>
                  <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4 }}>Density</Text>
                </View>
              )}
              {avgIntensity > 0 && (
                <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 16, alignItems: 'center' }}>
                  <Ionicons name="speedometer-outline" size={20} color={theme.chrome} style={{ marginBottom: 6 }} />
                  <Text style={{ fontSize: 20, fontWeight: '700', color: theme.text }}>{formatIntensity(avgIntensity)}</Text>
                  <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4 }}>{intensityZone} Zone</Text>
                </View>
              )}
            </View>
          )}

          {/* Top e1RM estimates */}
          {topE1RMs.length > 0 && (
            <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginTop: 12 }}>
              <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 10 }}>Estimated 1-Rep Max</Text>
              {topE1RMs.map((item, i) => (
                <View key={item.exerciseName} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: theme.border }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text, flex: 1 }} numberOfLines={1}>{item.exerciseName}</Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>{formatNumber(item.e1rm)} {unitLabel}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Volume by muscle group */}
          {volumeByMuscle.length > 0 && (
            <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginTop: 12 }}>
              <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 10 }}>Volume by Muscle</Text>
              {volumeByMuscle.map((item) => (
                <View key={item.muscle} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>{item.muscle}</Text>
                    <Text style={{ fontSize: 12, color: theme.textSecondary }}>{formatNumber(item.volume)} {unitLabel} ({item.percentage}%)</Text>
                  </View>
                  <View style={{ height: 6, backgroundColor: theme.border, borderRadius: 3, overflow: 'hidden' }}>
                    <View style={{ height: 6, backgroundColor: theme.chrome, borderRadius: 3, width: `${item.percentage}%` }} />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Share & Post buttons */}
        <View style={{ paddingHorizontal: 24, marginBottom: 24, gap: 10 }}>
          <Pressable
            onPress={() => router.push({
              pathname: '/workout/card-picker',
              params: {
                exercises: params.exercises ?? '[]',
                dayName: params.dayName ?? '',
                focus: params.focus ?? '',
                durationMinutes: params.durationMinutes ?? '0',
              },
            })}
            style={{
              backgroundColor: theme.surface,
              borderRadius: 16,
              paddingVertical: 16,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: theme.border,
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Ionicons name="share-outline" size={20} color={theme.text} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }}>Share Workout</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              const cardDataJson = JSON.stringify({
                focus: params.focus ?? '',
                dayName: params.dayName ?? '',
                sets: totalSets,
                reps: totalReps,
                volume: displayVolume,
                unitLabel,
                durationMinutes,
                muscles: musclesWorked,
              });
              router.push({ pathname: '/create-post', params: { cardData: cardDataJson } });
            }}
            style={{
              backgroundColor: theme.text,
              borderRadius: 16,
              paddingVertical: 16,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Ionicons name="people" size={18} color={theme.background} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: theme.background }}>Post to Forme</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Done button */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 32, paddingTop: 12, backgroundColor: theme.background }}>
        <Pressable
          onPress={() => router.replace('/(tabs)')}
          style={{ backgroundColor: theme.text, paddingVertical: 16, borderRadius: 16, alignItems: 'center' }}
        >
          <Text style={{ color: theme.background, fontWeight: '600', fontSize: 16 }}>Done</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
