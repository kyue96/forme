import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Svg, { Line, Circle, Rect, Text as SvgText } from 'react-native-svg';

import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';
import { LoggedExercise, LoggedSet } from '@/lib/types';
import { getExerciseImageUrls } from '@/lib/exercise-images';

interface DataPoint {
  date: string;
  maxWeight: number;
  volume: number;
  est1RM: number;
}

function SimpleLineChart({ data, valueKey, color, label, unit, theme }: {
  data: DataPoint[];
  valueKey: keyof DataPoint;
  color: string;
  label: string;
  unit: string;
  theme: any;
}) {
  if (data.length < 2) return null;

  const width = 320;
  const height = 140;
  const paddingX = 40;
  const paddingY = 20;
  const chartW = width - paddingX * 2;
  const chartH = height - paddingY * 2;

  const values = data.map((d) => d[valueKey] as number);
  const minVal = Math.min(...values) * 0.9;
  const maxVal = Math.max(...values) * 1.1;
  const range = maxVal - minVal || 1;

  const points = data.map((d, i) => ({
    x: paddingX + (i / (data.length - 1)) * chartW,
    y: paddingY + chartH - ((d[valueKey] as number) - minVal) / range * chartH,
  }));

  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginBottom: 8 }}>{label}</Text>
      <Svg width={width} height={height}>
        {/* Grid lines */}
        {[0, 0.5, 1].map((pct) => (
          <Line
            key={pct}
            x1={paddingX}
            y1={paddingY + chartH * (1 - pct)}
            x2={paddingX + chartW}
            y2={paddingY + chartH * (1 - pct)}
            stroke={theme.border}
            strokeWidth={1}
          />
        ))}
        {/* Y axis labels */}
        <SvgText x={4} y={paddingY + 4} fill={theme.textSecondary} fontSize={9}>
          {Math.round(maxVal)}
        </SvgText>
        <SvgText x={4} y={paddingY + chartH + 4} fill={theme.textSecondary} fontSize={9}>
          {Math.round(minVal)}
        </SvgText>
        {/* Line segments */}
        {points.map((p, i) => {
          if (i === 0) return null;
          const prev = points[i - 1];
          return (
            <Line
              key={i}
              x1={prev.x}
              y1={prev.y}
              x2={p.x}
              y2={p.y}
              stroke={color}
              strokeWidth={2}
            />
          );
        })}
        {/* Dots */}
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />
        ))}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 4 }}>
        <Text style={{ fontSize: 9, color: theme.textSecondary }}>{data[0].date}</Text>
        <Text style={{ fontSize: 9, color: theme.textSecondary }}>{data[data.length - 1].date}</Text>
      </View>
    </View>
  );
}

export default function ExerciseDetailScreen() {
  const { exerciseName } = useLocalSearchParams<{ exerciseName: string }>();
  const router = useRouter();
  const { theme, weightUnit } = useSettings();
  const unitLabel = weightUnit === 'lbs' ? 'lbs' : 'kg';

  const [loading, setLoading] = useState(true);
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const [heaviestSet, setHeaviestSet] = useState<{ weight: number; reps: number; date: string } | null>(null);
  const [maxVolumeSession, setMaxVolumeSession] = useState<{ volume: number; date: string } | null>(null);

  useFocusEffect(useCallback(() => {
    loadData();
  }, [exerciseName]));

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: logs } = await supabase
        .from('workout_logs')
        .select('exercises, completed_at')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: true });

      if (!logs) return;

      const points: DataPoint[] = [];
      let heaviest: { weight: number; reps: number; date: string } | null = null;
      let maxVol: { volume: number; date: string } | null = null;

      for (const log of logs) {
        const exs = log.exercises as LoggedExercise[];
        const matching = exs.find((e) => e.name === exerciseName);
        if (!matching) continue;

        const completedSets = matching.sets.filter((s) => s.completed);
        if (completedSets.length === 0) continue;

        const date = log.completed_at?.split('T')[0] ?? '';
        const maxWeight = Math.max(...completedSets.map((s) => s.weight ?? 0));
        const volume = completedSets.reduce((s, set) => s + (set.weight ?? 0) * set.reps, 0);

        // Est 1RM using Epley formula: weight × (1 + reps / 30)
        const heaviestCompletedSet = completedSets.reduce((best, s) =>
          (s.weight ?? 0) > (best.weight ?? 0) ? s : best, completedSets[0]);
        const est1RM = (heaviestCompletedSet.weight ?? 0) * (1 + heaviestCompletedSet.reps / 30);

        points.push({ date, maxWeight, volume, est1RM: Math.round(est1RM) });

        // Track PRs
        if (!heaviest || maxWeight > heaviest.weight) {
          heaviest = { weight: maxWeight, reps: heaviestCompletedSet.reps, date };
        }
        if (!maxVol || volume > maxVol.volume) {
          maxVol = { volume, date };
        }
      }

      setDataPoints(points);
      setHeaviestSet(heaviest);
      setMaxVolumeSession(maxVol);
    } catch {} finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: 16 }}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </Pressable>
        <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text, flex: 1 }} numberOfLines={1}>{exerciseName}</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.chrome} />
        </View>
      ) : dataPoints.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <Text style={{ fontSize: 15, color: theme.textSecondary, textAlign: 'center' }}>
            No logged data for this exercise yet.
          </Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
          {/* Exercise images - start and end position */}
          {(() => {
            const imgs = getExerciseImageUrls(exerciseName ?? '');
            if (!imgs) return null;
            return (
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                  <Image source={{ uri: imgs.start }} style={{ width: '100%', aspectRatio: 0.85 }} contentFit="cover" cachePolicy="disk" />
                  <Text style={{ fontSize: 10, fontWeight: '600', color: theme.textSecondary, textAlign: 'center', paddingVertical: 6 }}>START</Text>
                </View>
                <Ionicons name="arrow-forward" size={18} color={theme.textSecondary} />
                <View style={{ flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                  <Image source={{ uri: imgs.end }} style={{ width: '100%', aspectRatio: 0.85 }} contentFit="cover" cachePolicy="disk" />
                  <Text style={{ fontSize: 10, fontWeight: '600', color: theme.textSecondary, textAlign: 'center', paddingVertical: 6 }}>END</Text>
                </View>
              </View>
            );
          })()}

          {/* Personal records */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
            {heaviestSet && (
              <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border }}>
                <Ionicons name="trophy" size={20} color="#EAB308" />
                <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text, marginTop: 8 }}>
                  {heaviestSet.weight} {unitLabel}
                </Text>
                <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
                  Heaviest set · {heaviestSet.reps} reps
                </Text>
                <Text style={{ fontSize: 10, color: theme.textSecondary }}>{heaviestSet.date}</Text>
              </View>
            )}
            {maxVolumeSession && (
              <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border }}>
                <Ionicons name="bar-chart" size={20} color={theme.chrome} />
                <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text, marginTop: 8 }}>
                  {Math.round(maxVolumeSession.volume).toLocaleString()}
                </Text>
                <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
                  Max session volume
                </Text>
                <Text style={{ fontSize: 10, color: theme.textSecondary }}>{maxVolumeSession.date}</Text>
              </View>
            )}
          </View>

          {/* Charts */}
          <SimpleLineChart data={dataPoints} valueKey="maxWeight" color="#EAB308" label="Weight Over Time" unit={unitLabel} theme={theme} />
          <SimpleLineChart data={dataPoints} valueKey="volume" color="#22C55E" label="Volume Over Time" unit={unitLabel} theme={theme} />
          <SimpleLineChart data={dataPoints} valueKey="est1RM" color={theme.chrome} label="Estimated 1RM Trend" unit={unitLabel} theme={theme} />

          {/* Session history */}
          <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginTop: 8, marginBottom: 12 }}>Session History</Text>
          {dataPoints.slice().reverse().map((dp, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border }}>
              <Text style={{ fontSize: 13, color: theme.textSecondary }}>{dp.date}</Text>
              <Text style={{ fontSize: 13, color: theme.text, fontWeight: '600' }}>
                {dp.maxWeight} {unitLabel} · {Math.round(dp.volume)} vol
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
