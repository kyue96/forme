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

  // Build paired bars: match this week's workouts to last week's by focus label
  // Each pair has a last-week bar and this-week bar side by side
  interface BarPair { label: string; lastVol: number; thisVol: number; pct: number | null }
  const pairMap = new Map<string, { lastVol: number; thisVol: number }>();

  for (const d of lastWeekConverted) {
    const existing = pairMap.get(d.focusLabel);
    if (existing) existing.lastVol += d.volume;
    else pairMap.set(d.focusLabel, { lastVol: d.volume, thisVol: 0 });
  }
  for (const d of thisWeekConverted) {
    const existing = pairMap.get(d.focusLabel);
    if (existing) existing.thisVol += d.volume;
    else pairMap.set(d.focusLabel, { lastVol: 0, thisVol: d.volume });
  }

  const pairs: BarPair[] = [...pairMap.entries()].map(([label, { lastVol, thisVol }]) => ({
    label,
    lastVol,
    thisVol,
    pct: lastVol > 0 && thisVol > 0 ? Math.round(((thisVol - lastVol) / lastVol) * 100) : null,
  }));

  const allVolumes = pairs.flatMap(p => [p.lastVol, p.thisVol]);
  const maxVolume = Math.max(...allVolumes, 1);

  // Overall % change
  const lastWeekTotal = lastWeekConverted.reduce((s, d) => s + d.volume, 0);
  const thisWeekTotal = thisWeekConverted.reduce((s, d) => s + d.volume, 0);
  let pctChange: number | null = null;
  if (lastWeekTotal > 0 && thisWeekConverted.length > 0) {
    pctChange = Math.round(((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100);
  }

  // For pan responder: flatten pairs into selectable slots
  const showDays = pairs.map(p => ({ label: p.label, date: '', volume: p.thisVol || p.lastVol, prevVolume: p.lastVol }));
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
            {activeDay.prevVolume > 0 ? ` (prev: ${formatNumber(activeDay.prevVolume)})` : ''}
          </Text>
        ) : (
          <Text style={{ fontSize: 10, color: theme.textSecondary }}>
            {unitLabel} lifted · {lastWeekConverted.length > 0 ? 'last week vs this week' : 'this week'}
          </Text>
        )}
      </View>

      {/* Chart area */}
      <View style={{ flexDirection: 'row' }}>
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
          {/* Paired bars — last week + this week side by side per focus */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'flex-end', height: BAR_MAX_HEIGHT, zIndex: 1 }}>
            {pairs.map((pair, i) => {
              const lastH = scaleMax > 0 ? (pair.lastVol / scaleMax) * BAR_MAX_HEIGHT : 0;
              const thisH = scaleMax > 0 ? (pair.thisVol / scaleMax) * BAR_MAX_HEIGHT : 0;
              const singleBarW = Math.max(8, Math.min(18, 120 / pairs.length));
              const isSelected = i === selectedIdx;
              const pairPct = pair.pct;

              return (
                <View key={pair.label + i} style={{ alignItems: 'center', flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: BAR_MAX_HEIGHT }}>
                    {/* Last week bar (dimmer) */}
                    <LinearGradient
                      colors={isSelected
                        ? [barColor + '90', barColor + '60']
                        : [barColor + '60', barColor + '30']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={{
                        width: singleBarW,
                        height: Math.max(lastH, pair.lastVol > 0 ? 2 : 0),
                        borderRadius: 3,
                      }}
                    />
                    {/* This week bar (bright) */}
                    <LinearGradient
                      colors={isSelected
                        ? [barColor, barColor + '90']
                        : [barColor + 'DD', barColor + '80']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={{
                        width: singleBarW,
                        height: Math.max(thisH, pair.thisVol > 0 ? 2 : 0),
                        borderRadius: 3,
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
              );
            })}
          </View>
        </View>
      </View>

      {/* X-axis labels + % change */}
      <View style={{ flexDirection: 'row', marginTop: 6 }}>
        {pairs.map((pair, i) => (
          <View key={pair.label + i} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{
              fontSize: 9,
              fontWeight: i === selectedIdx ? '700' : '500',
              color: i === selectedIdx ? barColor : theme.textSecondary,
            }} numberOfLines={1}>
              {pair.label}
            </Text>
            {pair.pct !== null && (
              <Text style={{
                fontSize: 8, fontWeight: '700',
                color: pair.pct >= 0 ? '#22C55E' : '#EF4444',
                marginTop: 1,
              }}>
                {pair.pct >= 0 ? '+' : ''}{pair.pct}%
              </Text>
            )}
          </View>
        ))}
      </View>

      {/* Legend */}
      {lastWeekConverted.length > 0 && thisWeekConverted.length > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10, gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: barColor + '50' }} />
            <Text style={{ fontSize: 10, color: theme.textSecondary }}>Last week</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: barColor + 'DD' }} />
            <Text style={{ fontSize: 10, color: theme.textSecondary }}>This week</Text>
          </View>
        </View>
      )}
    </View>
  );
}
