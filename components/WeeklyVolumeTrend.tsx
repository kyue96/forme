import React, { useEffect, useRef, useState } from 'react';
import { PanResponder, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';
import { LoggedExercise } from '@/lib/types';
import { computeTotalVolume } from '@/lib/workout-metrics';
import { formatNumber } from '@/lib/utils';

interface DayVolume {
  date: string;
  dayAbbr: string;
  focusLabel: string;
  volume: number;
}

interface Props {
  userId: string;
  accentColor?: string;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

const DAY_ABBRS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getWeekRange(weeksAgo: number): { start: string; end: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
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
      const focusLabel = focus ? focus.split(/[\s(]/)[0] : DAY_ABBRS[d.getDay()];
      return { date, dayAbbr: DAY_ABBRS[d.getDay()], focusLabel, volume };
    });
}

/** Compute 3-4 nice y-axis tick values */
function computeYTicks(max: number): number[] {
  if (max <= 0) return [0];
  // Target 3 ticks (top, middle, 0)
  const rawStep = max / 3;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const niceSteps = [1, 2, 2.5, 5, 10];
  let step = magnitude;
  for (const ns of niceSteps) {
    if (ns * magnitude >= rawStep) { step = ns * magnitude; break; }
  }
  const ticks: number[] = [];
  const topTick = Math.ceil(max / step) * step;
  for (let v = topTick; v >= 0; v -= step) {
    ticks.push(Math.round(v));
  }
  if (ticks[ticks.length - 1] !== 0) ticks.push(0);
  // Cap at 4 ticks to prevent overlap
  if (ticks.length > 4) {
    return [ticks[0], ticks[Math.floor(ticks.length / 2)], 0];
  }
  return ticks;
}

export default function WeeklyVolumeTrend({ userId, accentColor, onInteractionStart, onInteractionEnd }: Props) {
  const { theme, weightUnit } = useSettings();
  const [thisWeek, setThisWeek] = useState<DayVolume[]>([]);
  const [lastWeek, setLastWeek] = useState<DayVolume[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const chartLayoutRef = useRef({ x: 0, width: 0 });
  const showDaysRef = useRef<{ label: string; date: string; volume: number; prevVolume: number }[]>([]);
  const callbacksRef = useRef({ onInteractionStart, onInteractionEnd });
  callbacksRef.current = { onInteractionStart, onInteractionEnd };

  // PanResponder for drag-to-scrub (must be declared before any early return)
  const getIndexFromX = (pageX: number) => {
    const { x, width } = chartLayoutRef.current;
    if (width === 0) return null;
    const relX = pageX - x;
    const days = showDaysRef.current;
    if (days.length === 0) return null;
    const idx = Math.floor((relX / width) * days.length);
    return Math.max(0, Math.min(days.length - 1, idx));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        callbacksRef.current.onInteractionStart?.();
        const idx = getIndexFromX(e.nativeEvent.pageX);
        if (idx !== null) setSelectedIdx(prev => prev === idx ? null : idx);
      },
      onPanResponderMove: (e) => {
        const idx = getIndexFromX(e.nativeEvent.pageX);
        if (idx !== null) setSelectedIdx(idx);
      },
      onPanResponderRelease: () => { setSelectedIdx(null); callbacksRef.current.onInteractionEnd?.(); },
      onPanResponderTerminate: () => { setSelectedIdx(null); callbacksRef.current.onInteractionEnd?.(); },
    })
  ).current;

  const barColor = accentColor || '#F59E0B';
  const barColorDimmed = barColor + '40';
  const unitLabel = weightUnit === 'lbs' ? 'lbs' : 'kg';

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
  const thisWeekConverted = thisWeek.map(d => ({ ...d, volume: Math.round(d.volume) })).filter(d => d.volume > 0);
  const lastWeekConverted = lastWeek.map(d => ({ ...d, volume: Math.round(d.volume) })).filter(d => d.volume > 0);

  if (thisWeekConverted.length === 0 && lastWeekConverted.length === 0) return null;

  // Flat bar list: last week's workouts + this week's workouts
  // Each bar is one workout session, labeled by focus name
  const showDays: { label: string; date: string; volume: number; prevVolume: number; isLastWeek: boolean }[] = [];

  for (const d of lastWeekConverted) {
    showDays.push({ label: d.focusLabel, date: d.date, volume: d.volume, prevVolume: 0, isLastWeek: true });
  }
  for (const d of thisWeekConverted) {
    showDays.push({ label: d.focusLabel, date: d.date, volume: d.volume, prevVolume: 0, isLastWeek: false });
  }

  const allVolumes = showDays.map(d => d.volume);
  const maxVolume = Math.max(...allVolumes, 1);

  // % change: compare total volumes between weeks
  const lastWeekTotal = lastWeekConverted.reduce((s, d) => s + d.volume, 0);
  const thisWeekTotal = thisWeekConverted.reduce((s, d) => s + d.volume, 0);
  let pctChange: number | null = null;
  if (lastWeekTotal > 0 && thisWeekConverted.length > 0) {
    pctChange = Math.round(((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100);
  }

  showDaysRef.current = showDays;

  const yAxisTicks = computeYTicks(maxVolume);
  const scaleMax = yAxisTicks[0] || maxVolume;
  const BAR_MAX_HEIGHT = 100;

  const activeDay = selectedIdx !== null ? showDays[selectedIdx] : null;

  return (
    <View style={{
      backgroundColor: theme.surface, borderRadius: 16,
      borderWidth: 1, borderColor: theme.border, padding: 16,
    }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>
          Volume Trend
        </Text>
        {pctChange !== null && thisWeekConverted.length > 0 && (
          <Text style={{
            fontSize: 12, fontWeight: '600',
            color: pctChange >= 0 ? '#22C55E' : '#EF4444',
          }}>
            {pctChange >= 0 ? '+' : ''}{pctChange}% from last week
          </Text>
        )}
      </View>

      {/* Selected value tooltip */}
      <View style={{ height: 20, marginBottom: 8 }}>
        {activeDay ? (
          <Text style={{ fontSize: 12, fontWeight: '700', color: barColor }}>
            {activeDay.label}: {formatNumber(activeDay.volume)} {unitLabel}
            {activeDay.isLastWeek ? ' (last week)' : ''}
          </Text>
        ) : (
          <Text style={{ fontSize: 10, color: theme.textSecondary }}>
            {unitLabel} lifted · {lastWeekConverted.length > 0 ? 'last week → this week' : 'this week'}
          </Text>
        )}
      </View>

      {/* Chart area */}
      <View style={{ flexDirection: 'row' }}>
        {/* Y-axis */}
        <View style={{ width: 36, marginRight: 6 }}>
          <View style={{ height: BAR_MAX_HEIGHT, justifyContent: 'space-between' }}>
            {yAxisTicks.map((tick, i) => (
              <Text key={i} style={{ fontSize: 9, color: theme.textSecondary, textAlign: 'right', lineHeight: 11 }}>
                {tick >= 1000 ? `${Math.round(tick / 1000)}k` : tick}
              </Text>
            ))}
          </View>
        </View>

        {/* Bars with PanResponder */}
        <View
          style={{ flex: 1, position: 'relative', height: BAR_MAX_HEIGHT }}
          onLayout={(e) => {
            e.target.measureInWindow((x, _y, width) => {
              chartLayoutRef.current = { x, width };
            });
          }}
          {...panResponder.panHandlers}
        >
          {/* Grid lines */}
          {yAxisTicks.map((tick, i) => {
            const yPos = scaleMax > 0 ? ((scaleMax - tick) / scaleMax) * BAR_MAX_HEIGHT : 0;
            return (
              <View key={`grid-${i}`} style={{
                position: 'absolute', top: yPos, left: 0, right: 0,
                height: 1, backgroundColor: theme.border, opacity: 0.3,
              }} />
            );
          })}

          {/* Individual bars — each bar = one workout session */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'flex-end', height: BAR_MAX_HEIGHT, zIndex: 1 }}>
            {showDays.map((day, i) => {
              const barHeight = scaleMax > 0 ? (day.volume / scaleMax) * BAR_MAX_HEIGHT : 0;
              const singleBarW = Math.max(10, Math.min(22, 160 / showDays.length));
              const isSelected = i === selectedIdx;
              // Last week bars are dimmer, this week bars are bright
              const isLW = day.isLastWeek;

              // Visual separator between last week and this week
              const isFirstThisWeek = !isLW && (i === 0 || showDays[i - 1]?.isLastWeek);

              return (
                <View key={day.date + i} style={{ alignItems: 'center', flex: 1, flexDirection: 'row', justifyContent: 'center' }}>
                  {isFirstThisWeek && lastWeekConverted.length > 0 && (
                    <View style={{ width: 1, height: BAR_MAX_HEIGHT * 0.6, backgroundColor: theme.border, opacity: 0.5, marginRight: 2 }} />
                  )}
                  <View style={{ alignItems: 'center' }}>
                    <View style={{ height: BAR_MAX_HEIGHT, justifyContent: 'flex-end' }}>
                      <LinearGradient
                        colors={isSelected
                          ? [barColor, barColor + '90']
                          : isLW
                            ? [barColor + '70', barColor + '40']
                            : [barColor + 'DD', barColor + '80']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={{
                          width: singleBarW,
                          height: Math.max(barHeight, 2),
                          borderRadius: 4,
                          ...(isSelected && {
                            shadowColor: barColor,
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.4,
                            shadowRadius: 4,
                            elevation: 3,
                          }),
                        }}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* X-axis labels */}
      <View style={{ flexDirection: 'row', marginTop: 6, marginLeft: 42 }}>
        {showDays.map((day, i) => (
          <View key={day.date + i} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{
              fontSize: 9,
              fontWeight: i === selectedIdx ? '700' : '500',
              color: i === selectedIdx ? barColor : theme.textSecondary,
            }} numberOfLines={1}>
              {day.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Legend */}
      {lastWeekConverted.length > 0 && thisWeekConverted.length > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10, gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: barColor + 'DD' }} />
            <Text style={{ fontSize: 10, color: theme.textSecondary }}>This week</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: barColor + '50' }} />
            <Text style={{ fontSize: 10, color: theme.textSecondary }}>Last week</Text>
          </View>
        </View>
      )}
    </View>
  );
}
