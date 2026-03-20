import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSettings } from '@/lib/settings-context';
import { LoggedExercise } from '@/lib/types';
import { formatNumber, stripParens } from '@/lib/utils';
import {
  computeTopE1RMs,
  computeVolumeByMuscle,
} from '@/lib/workout-metrics';
import { MuscleGroupPills } from '@/components/MuscleGroupPills';
import { getExerciseCategories } from '@/lib/exercise-utils';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/lib/user-store';
import { StreakRing } from '@/components/StreakRing';
import { dateKey } from '@/components/WeeklyCalendar';

interface VolumeChartProps {
  data: Array<{ volume: number; date: string; label: string }>;
  theme: any;
  avatarColor: string | null;
  currentIndex: number;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

function VolumeChart({ data, theme, avatarColor, currentIndex, onInteractionStart, onInteractionEnd }: VolumeChartProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const highlightColor = avatarColor || '#F59E0B';
  const chartHeight = 160;
  const barMinHeight = 4;
  const yAxisWidth = 52;
  const chartLayoutRef = useRef({ x: 0, width: 0 });

  // Y-axis: scale in increments of 5,000, max 100,000
  const rawMax = Math.max(...data.map(d => d.volume), 1);
  const scaleMax = Math.min(Math.ceil(rawMax / 5000) * 5000, 100000) || 5000;
  const tickCount = Math.min(scaleMax / 5000, 5);
  const ticks: number[] = [];
  for (let i = 0; i <= tickCount; i++) {
    ticks.push(Math.round((scaleMax / tickCount) * (tickCount - i)));
  }

  const getIndexFromX = (pageX: number) => {
    const { x, width } = chartLayoutRef.current;
    if (width === 0) return null;
    const relX = pageX - x;
    const idx = Math.floor((relX / width) * data.length);
    return Math.max(0, Math.min(data.length - 1, idx));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        onInteractionStart?.();
        const idx = getIndexFromX(e.nativeEvent.pageX);
        if (idx !== null) setSelectedIdx(prev => prev === idx ? null : idx);
      },
      onPanResponderMove: (e) => {
        const idx = getIndexFromX(e.nativeEvent.pageX);
        if (idx !== null) setSelectedIdx(idx);
      },
      onPanResponderRelease: () => { onInteractionEnd?.(); },
      onPanResponderTerminate: () => { onInteractionEnd?.(); },
    })
  ).current;

  // Which bar to show label for
  const activeIdx = selectedIdx ?? currentIndex;

  return (
    <View>
      {/* Volume label for selected/current bar */}
      <View style={{ height: 20, alignItems: 'center', marginBottom: 4 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: activeIdx === currentIndex ? highlightColor : theme.text }}>
          {formatNumber(data[activeIdx]?.volume ?? 0)} {activeIdx === currentIndex ? '(today)' : ''}
        </Text>
      </View>

      <View style={{ flexDirection: 'row' }}>
        {/* Y-axis */}
        <View style={{ width: yAxisWidth, height: chartHeight, justifyContent: 'space-between' }}>
          {ticks.map((tick, i) => (
            <Text key={i} style={{ fontSize: 9, color: theme.textSecondary, textAlign: 'left' }}>
              {formatNumber(tick)}
            </Text>
          ))}
        </View>

        {/* Chart area with drag-to-scrub */}
        <View
          style={{ flex: 1, height: chartHeight, position: 'relative' }}
          onLayout={(e) => {
            e.target.measureInWindow((x, _y, width) => {
              chartLayoutRef.current = { x, width };
            });
          }}
          {...panResponder.panHandlers}
        >
          {/* Grid lines (behind bars) */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
            {ticks.map((_, i) => (
              <View
                key={`grid-${i}`}
                style={{
                  position: 'absolute',
                  top: (chartHeight / (ticks.length - 1)) * i,
                  left: 0,
                  right: 0,
                  height: 1,
                  backgroundColor: theme.border,
                  opacity: 0.3,
                }}
              />
            ))}
          </View>

          {/* Bars (in front of grid) */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: chartHeight, gap: 4, paddingHorizontal: 2, zIndex: 1 }}>
            {data.map((item, idx) => {
              const isCurrent = idx === currentIndex;
              const isSelected = idx === selectedIdx;
              const heightPercent = scaleMax > 0 ? (item.volume / scaleMax) * 100 : 0;
              const barHeight = Math.max(heightPercent * (chartHeight / 100), barMinHeight);
              const isActive = isCurrent || isSelected;

              const gradientColors = isCurrent
                ? [highlightColor, highlightColor + '80'] as const
                : isSelected
                  ? [theme.text, theme.text + '80'] as const
                  : [theme.chrome + '50', theme.chrome + '20'] as const;

              return (
                <View
                  key={idx}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: chartHeight }}
                >
                  <LinearGradient
                    colors={gradientColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={{
                      width: '80%',
                      height: barHeight,
                      borderRadius: 6,
                      ...(isActive && {
                        shadowColor: isCurrent ? highlightColor : theme.text,
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.35,
                        shadowRadius: 6,
                        elevation: 4,
                      }),
                    }}
                  />
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* X-axis: Date labels */}
      <View style={{ flexDirection: 'row', gap: 4, marginTop: 6, marginLeft: yAxisWidth, paddingHorizontal: 2 }}>
        {data.map((item, idx) => (
          <Text
            key={idx}
            style={{
              flex: 1,
              fontSize: 9,
              fontWeight: idx === currentIndex || idx === selectedIdx ? '700' : '400',
              color: idx === currentIndex ? highlightColor : (idx === selectedIdx ? theme.text : theme.textSecondary),
              textAlign: 'center',
            }}
          >
            {item.label}
          </Text>
        ))}
      </View>
    </View>
  );
}


export default function PostWorkoutScreen() {
  const router = useRouter();
  const { weightUnit, theme } = useSettings();
  const { avatarColor } = useUserStore();
  const params = useLocalSearchParams<{
    exercises: string;
    dayName: string;
    focus: string;
    durationMinutes: string;
    startedAt: string;
  }>();

  const [historicalVolumes, setHistoricalVolumes] = useState<Array<{ volume: number; date: string; label: string }>>([]);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);

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
  const displayVolume = Math.round(totalVolume);
  const unitLabel = weightUnit === 'lbs' ? 'lbs' : 'kg';
  const exerciseCategories = getExerciseCategories(exercises);

  // Advanced metrics
  const topE1RMs = computeTopE1RMs(exercises, 3);
  const volumeByMuscle = computeVolumeByMuscle(exercises);

  useEffect(() => {
    fetchHistoricalVolumes();
    fetchStreak();
  }, []);

  const fetchStreak = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const start = new Date();
      start.setDate(start.getDate() - 60);
      const { data: logs } = await supabase
        .from('workout_logs')
        .select('completed_at')
        .eq('user_id', user.id)
        .gte('completed_at', dateKey(start))
        .order('completed_at', { ascending: false });

      const dates = new Set((logs ?? []).map((l: any) => l.completed_at?.split('T')[0]).filter(Boolean));
      // Current streak
      let s = 0;
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      if (!dates.has(dateKey(d))) d.setDate(d.getDate() - 1);
      while (dates.has(dateKey(d))) { s++; d.setDate(d.getDate() - 1); }
      setStreak(s);
      // Max streak
      const sorted = Array.from(dates).sort();
      let best = 0, run = 1;
      for (let i = 1; i < sorted.length; i++) {
        const diff = Math.round((new Date(sorted[i] + 'T12:00:00').getTime() - new Date(sorted[i - 1] + 'T12:00:00').getTime()) / 86400000);
        if (diff === 1) run++; else { best = Math.max(best, run); run = 1; }
      }
      setMaxStreak(Math.max(best, run));
    } catch {}
  };

  const fetchHistoricalVolumes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: logs } = await supabase
        .from('workout_logs')
        .select('exercises, completed_at, duration_minutes')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(8);

      if (logs && logs.length > 0) {
        const volumes = logs.map((log) => {
          const logExercises = Array.isArray(log.exercises) ? log.exercises : JSON.parse(log.exercises || '[]');
          const logVolume = logExercises.reduce(
            (sum: number, ex: LoggedExercise) =>
              sum + ex.sets.filter((s: any) => s.completed && s.weight != null)
                .reduce((s: number, set: any) => s + (set.weight ?? 0) * set.reps, 0),
            0
          );
          const convertedVolume = Math.round(logVolume);
          const date = new Date(log.completed_at);
          const label = `${date.getMonth() + 1}/${date.getDate()}`;
          return { volume: convertedVolume, date: log.completed_at, label };
        });
        setHistoricalVolumes(volumes.reverse());
      }
    } catch (error) {
      console.error('Failed to fetch historical volumes:', error);
    }
  };

  const formatDuration = (mins: number): string => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      {/* Sticky header */}
      <View style={{
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: theme.background,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={{ padding: 4, marginRight: 8 }}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text, flex: 1 }} numberOfLines={1}>
                {stripParens(params.focus || params.dayName || '')}
              </Text>
              <MuscleGroupPills categories={exerciseCategories} size="small" />
            </View>
            <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2 }}>
              {params.startedAt
                ? new Date(params.startedAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                : new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
              }
            </Text>
          </View>
        </View>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false} scrollEnabled={scrollEnabled}>

        {/* Summary metrics */}
        <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
          {/* Volume hero card */}
          {displayVolume > 0 && (
            <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 24, marginBottom: 12, alignItems: 'center' }}>
              <Text style={{ fontSize: 42, fontWeight: '800', color: theme.text }}>{formatNumber(displayVolume)}</Text>
              <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 6 }}>{weightUnit === 'lbs' ? 'pounds moved' : 'kilograms moved'}</Text>
            </View>
          )}

          {/* Three smaller cards: Sets, Reps, Time */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 26, fontWeight: '700', color: theme.text }}>{totalSets}</Text>
              <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}>sets</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 26, fontWeight: '700', color: theme.text }}>{totalReps}</Text>
              <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}>reps</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 26, fontWeight: '700', color: theme.text }}>{formatDuration(durationMinutes)}</Text>
              <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}>time</Text>
            </View>
          </View>

          {/* Streak Ring */}
          {streak > 0 && (
            <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <StreakRing streak={streak} maxStreak={maxStreak} size="mini" color={avatarColor || '#F59E0B'} />
              <View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>{streak}-day streak</Text>
                <Text style={{ fontSize: 11, color: theme.textSecondary }}>Keep it going!</Text>
              </View>
            </View>
          )}

          {/* Volume Trend Chart */}
          {historicalVolumes.length > 1 && (
            <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginTop: 12 }}>
              <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 12 }}>Volume Trend</Text>
              <VolumeChart data={historicalVolumes} theme={theme} avatarColor={avatarColor} currentIndex={historicalVolumes.length - 1} onInteractionStart={() => setScrollEnabled(false)} onInteractionEnd={() => setScrollEnabled(true)} />
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

      </ScrollView>
      {/* Sticky footer buttons */}
      <View style={{
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: theme.background,
        borderTopWidth: 1,
        borderTopColor: theme.border,
        flexDirection: 'row',
        gap: 10,
      }}>
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
            flex: 1,
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text, letterSpacing: 1 }}>SHARE</Text>
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
              muscles: exerciseCategories,
            });
            router.push({ pathname: '/create-post', params: { cardData: cardDataJson } });
          }}
          style={{
            flex: 1,
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: 'center',
            backgroundColor: theme.text,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.background, letterSpacing: 1 }}>POST TO FEED</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
