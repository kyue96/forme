import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';
import { LoggedExercise } from '@/lib/types';
import { computeTotalVolume } from '@/lib/workout-metrics';
import { formatNumber } from '@/lib/utils';

interface DayVolume {
  date: string;
  dayAbbr: string;
  focusLabel: string; // e.g. "Push", "Pull", "Legs"
  volume: number; // in kg (raw from DB)
}

interface Props {
  userId: string;
  accentColor?: string;
}

const DAY_ABBRS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getWeekRange(weeksAgo: number): { start: string; end: string } {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() - dayOfWeek - weeksAgo * 7);
  startOfThisWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfThisWeek);
  endOfWeek.setDate(startOfThisWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return { start: fmt(startOfThisWeek), end: fmt(endOfWeek) };
}

function parseLogs(logs: { completed_at: string; day_name?: string; exercises: LoggedExercise[] }[]): DayVolume[] {
  // Group by date, keep the focus/day_name from the first log per date
  const byDate: Record<string, { volume: number; focus: string }> = {};
  for (const log of logs) {
    const date = log.completed_at?.split('T')[0];
    if (!date) continue;
    const vol = computeTotalVolume(log.exercises ?? []);
    if (!byDate[date]) {
      byDate[date] = { volume: vol, focus: log.day_name ?? '' };
    } else {
      byDate[date].volume += vol;
    }
  }
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { volume, focus }]) => {
      const d = new Date(date + 'T12:00:00');
      // Extract short focus label: "Push Day" -> "Push", "Upper Body" -> "Upper"
      const focusLabel = focus ? focus.split(/[\s(]/)[0] : DAY_ABBRS[d.getDay()];
      return { date, dayAbbr: DAY_ABBRS[d.getDay()], focusLabel, volume };
    });
}

export default function WeeklyVolumeTrend({ userId, accentColor }: Props) {
  const { theme, weightUnit } = useSettings();
  const [thisWeek, setThisWeek] = useState<DayVolume[]>([]);
  const [lastWeek, setLastWeek] = useState<DayVolume[]>([]);

  const barColor = accentColor || '#F59E0B';
  const barColorDimmed = barColor + '40'; // 25% opacity

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      const thisRange = getWeekRange(0);
      const lastRange = getWeekRange(1);

      const [{ data: thisData }, { data: lastData }] = await Promise.all([
        supabase
          .from('workout_logs')
          .select('completed_at, day_name, exercises')
          .eq('user_id', userId)
          .gte('completed_at', thisRange.start)
          .lte('completed_at', thisRange.end + 'T23:59:59'),
        supabase
          .from('workout_logs')
          .select('completed_at, day_name, exercises')
          .eq('user_id', userId)
          .gte('completed_at', lastRange.start)
          .lte('completed_at', lastRange.end + 'T23:59:59'),
      ]);

      if (cancelled) return;
      setThisWeek(parseLogs((thisData as any[]) ?? []));
      setLastWeek(parseLogs((lastData as any[]) ?? []));
    })();

    return () => { cancelled = true; };
  }, [userId]);

  // Volumes are already in user's unit (stored as-entered), just round
  // Filter out days with 0 volume (rest days that somehow got logged)
  const thisWeekConverted = thisWeek
    .map((d) => ({ ...d, volume: Math.round(d.volume) }))
    .filter((d) => d.volume > 0);
  const lastWeekConverted = lastWeek
    .map((d) => ({ ...d, volume: Math.round(d.volume) }))
    .filter((d) => d.volume > 0);

  // Nothing to show if no workouts this week or last week
  if (thisWeekConverted.length === 0 && lastWeekConverted.length === 0) return null;

  // Pair by index: 1st workout this week vs 1st workout last week, 2nd vs 2nd, etc.
  const maxLen = Math.max(thisWeekConverted.length, lastWeekConverted.length);
  const showDays: { label: string; date: string; volume: number; prevVolume: number }[] = [];
  for (let i = 0; i < maxLen; i++) {
    const cur = thisWeekConverted[i];
    const prev = lastWeekConverted[i];
    showDays.push({
      label: cur?.focusLabel ?? prev?.focusLabel ?? `W${i + 1}`,
      date: cur?.date ?? prev?.date ?? '',
      volume: cur?.volume ?? 0,
      prevVolume: prev?.volume ?? 0,
    });
  }

  // Compute max volume for scaling (across both weeks)
  const allVolumes = showDays.flatMap((d) => [d.volume, d.prevVolume]);
  const maxVolume = Math.max(...allVolumes, 1);

  // Percentage change: average per-day comparison (1st vs 1st, 2nd vs 2nd, etc.)
  const paired = showDays.filter((d) => d.volume > 0 && d.prevVolume > 0);
  let pctChange: number | null = null;
  if (paired.length > 0) {
    const avgPct = paired.reduce((sum, d) => sum + ((d.volume - d.prevVolume) / d.prevVolume), 0) / paired.length;
    pctChange = Math.round(avgPct * 100);
  }

  // Y-axis: pick nice increments
  const yAxisTicks = computeYTicks(maxVolume);

  const BAR_MAX_HEIGHT = 100;

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 16,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>
          Weekly Volume Trend
        </Text>
        {pctChange !== null && thisWeekConverted.length > 0 && (
          <Text
            style={{
              fontSize: 12,
              fontWeight: '600',
              color: pctChange >= 0 ? '#22C55E' : '#EF4444',
            }}
          >
            {pctChange >= 0 ? '+' : ''}{pctChange}% from last week
          </Text>
        )}
      </View>

      {/* Chart area */}
      <View style={{ flexDirection: 'row' }}>
        {/* Y-axis labels */}
        <View style={{ width: 40, marginRight: 4 }}>
          <Text style={{ fontSize: 8, color: theme.textSecondary, textAlign: 'right', marginBottom: 2, fontWeight: '600' }}>
            {weightUnit}
          </Text>
          <View style={{ height: BAR_MAX_HEIGHT, justifyContent: 'space-between' }}>
            {yAxisTicks.map((tick, i) => (
              <Text
                key={i}
                style={{
                  fontSize: 9,
                  color: theme.textSecondary,
                  textAlign: 'right',
                  lineHeight: 12,
                }}
              >
                {tick >= 1000 ? `${(tick / 1000).toFixed(tick % 1000 === 0 ? 0 : 1)}k` : tick}
              </Text>
            ))}
          </View>
        </View>

        {/* Bars */}
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'flex-end', height: BAR_MAX_HEIGHT }}>
          {showDays.map((day, i) => {
            const curHeight = maxVolume > 0 ? (day.volume / maxVolume) * BAR_MAX_HEIGHT : 0;
            const prevHeight = maxVolume > 0 ? (day.prevVolume / maxVolume) * BAR_MAX_HEIGHT : 0;
            const singleBarW = Math.max(10, Math.min(18, 120 / showDays.length));
            const hasPrev = day.prevVolume > 0;

            return (
              <View key={day.date + i} style={{ alignItems: 'center', flex: 1 }}>
                {/* Side-by-side bar pair */}
                <View style={{ height: BAR_MAX_HEIGHT, justifyContent: 'flex-end', flexDirection: 'row', alignItems: 'flex-end', gap: hasPrev ? 3 : 0 }}>
                  {/* Previous week bar (left, dimmed) */}
                  {hasPrev && (
                    <View
                      style={{
                        width: singleBarW,
                        height: Math.max(prevHeight, 2),
                        backgroundColor: barColorDimmed,
                        borderRadius: 4,
                      }}
                    />
                  )}
                  {/* Current week bar (right, solid) */}
                  <View
                    style={{
                      width: singleBarW,
                      height: Math.max(curHeight, 2),
                      backgroundColor: barColor,
                      borderRadius: 4,
                    }}
                  />
                </View>
                {/* Workout focus label */}
                <Text style={{ fontSize: 9, color: theme.textSecondary, marginTop: 6 }} numberOfLines={1}>
                  {day.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Legend */}
      {showDays.some((d) => d.prevVolume > 0) && showDays.some((d) => d.volume > 0) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10, gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: barColor }} />
            <Text style={{ fontSize: 10, color: theme.textSecondary }}>This week</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: barColorDimmed }} />
            <Text style={{ fontSize: 10, color: theme.textSecondary }}>Last week</Text>
          </View>
        </View>
      )}

      {/* Y-axis unit already shown at top of axis */}
    </View>
  );
}

/** Compute ~4 nice y-axis tick values from max down to 0. */
function computeYTicks(max: number): number[] {
  if (max <= 0) return [0];
  // Find a nice step
  const rawStep = max / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const niceSteps = [1, 2, 2.5, 5, 10];
  let step = magnitude;
  for (const ns of niceSteps) {
    if (ns * magnitude >= rawStep) {
      step = ns * magnitude;
      break;
    }
  }
  const ticks: number[] = [];
  const topTick = Math.ceil(max / step) * step;
  for (let v = topTick; v >= 0; v -= step) {
    ticks.push(Math.round(v));
  }
  // Ensure 0 is included
  if (ticks[ticks.length - 1] !== 0) ticks.push(0);
  return ticks;
}
