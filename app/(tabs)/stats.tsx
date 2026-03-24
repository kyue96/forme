import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { BadgesTab } from '@/components/BadgesTab';
import { useBadgeStore } from '@/lib/badge-store';
import { StreakRing } from '@/components/StreakRing';
import { VolumeChart, VolumeChartData } from '@/components/VolumeChart';
import { AppHeader } from '@/components/AppHeader';

import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';
import { useUserStore } from '@/lib/user-store';
import { LoggedExercise } from '@/lib/types';
import { animateLayout, formatNumber } from '@/lib/utils';
import { PersonalRecordsSection } from '@/components/PersonalRecordsSection';
import { dateKey, getWeekDates } from '@/components/WeeklyCalendar';
import { getExerciseCategory, getExerciseCategories } from '@/lib/exercise-utils';
import { StrengthRadar, groupForRadar } from '@/components/StrengthRadar';

interface WorkoutLog {
  id: string;
  day_name: string;
  exercises: LoggedExercise[];
  duration_minutes: number;
  completed_at: string;
}

// ─── Helper: get Monday of the week containing a date ───
function getSunday(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  copy.setDate(copy.getDate() - day); // go back to Sunday
  copy.setHours(0, 0, 0, 0);
  return copy;
}

// ─── Helper: format date as "3/10" ───
function shortDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ─── Helper: compute volume for a single log (in kg) ───
function logVolume(log: WorkoutLog): number {
  return (log.exercises as LoggedExercise[]).reduce((sum, ex) =>
    sum + ex.sets
      .filter(s => s.completed && s.weight != null)
      .reduce((v, s) => v + (s.weight ?? 0) * s.reps, 0),
    0,
  );
}

// ─── Bar Chart Component (plain RN Views) ───
function BarChart({
  data,
  labels,
  barColor,
  theme,
  height = 120,
  onInteractionStart,
  onInteractionEnd,
  formatValue,
}: {
  data: number[];
  labels: string[];
  barColor: string;
  theme: any;
  height?: number;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
  formatValue?: (v: number) => string;
}) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const chartLayoutRef = useRef({ x: 0, width: 0 });
  const maxVal = Math.max(...data, 1);

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
      onPanResponderRelease: () => { setSelectedIdx(null); onInteractionEnd?.(); },
      onPanResponderTerminate: () => { setSelectedIdx(null); onInteractionEnd?.(); },
    })
  ).current;

  const activeIdx = selectedIdx;
  const displayVal = activeIdx !== null ? data[activeIdx] : null;

  return (
    <View>
      {/* Selected value tooltip */}
      <View style={{ height: 18, alignItems: 'center', marginBottom: 4 }}>
        {displayVal !== null && (
          <Text style={{ fontSize: 12, fontWeight: '700', color: barColor }}>
            {formatValue ? formatValue(displayVal) : Math.round(displayVal)} — {labels[activeIdx!]}
          </Text>
        )}
      </View>
      <View
        style={{ height, position: 'relative' }}
        onLayout={(e) => {
          e.target.measureInWindow((x, _y, width) => {
            chartLayoutRef.current = { x, width };
          });
        }}
        {...panResponder.panHandlers}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 4 }}>
          {data.map((val, i) => {
            const barH = maxVal > 0 ? Math.max((val / maxVal) * height, val > 0 ? 4 : 0) : 0;
            const isSelected = i === selectedIdx;
            return (
              <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height }}>
                <LinearGradient
                  colors={isSelected
                    ? [barColor, barColor + '80']
                    : val > 0
                      ? [barColor + 'CC', barColor + '60']
                      : [theme.chrome + '30', theme.chrome + '15']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={{
                    width: '70%',
                    height: barH,
                    borderRadius: 4,
                    ...(isSelected && {
                      shadowColor: barColor,
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
      <View style={{ flexDirection: 'row', marginTop: 6, gap: 4 }}>
        {labels.map((label, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{
              fontSize: 9,
              fontWeight: i === selectedIdx ? '700' : '500',
              color: i === selectedIdx ? barColor : theme.textSecondary,
            }} numberOfLines={1}>
              {label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Interactive Line Chart with gradient area fill + drag-to-scrub ───
function LineChart({
  data,
  labels,
  lineColor,
  gradientColor,
  theme,
  height = 120,
  formatValue,
  onInteractionStart,
  onInteractionEnd,
}: {
  data: number[];
  labels: string[];
  lineColor: string;
  gradientColor?: string;
  theme: any;
  height?: number;
  formatValue?: (v: number) => string;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const chartLayoutRef = useRef({ x: 0, width: 0 });

  if (data.length === 0) return null;
  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const range = maxVal - minVal || 1;
  const paddedMin = minVal - range * 0.05;
  const paddedRange = range * 1.1 || 1;
  const dotSize = 6;
  const fillColor = gradientColor || lineColor;

  // Y-axis: 3-4 nice ticks
  const rawStep = paddedRange / 3;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const niceSteps = [1, 2, 2.5, 5, 10];
  let step = magnitude;
  for (const ns of niceSteps) {
    if (ns * magnitude >= rawStep) { step = ns * magnitude; break; }
  }
  const yMin = Math.floor(paddedMin / step) * step;
  const yMax = Math.ceil((paddedMin + paddedRange) / step) * step;
  const yTicks: number[] = [];
  for (let v = yMax; v >= yMin; v -= step) {
    yTicks.push(Math.round(v * 10) / 10);
  }

  const getIndexFromX = (pageX: number) => {
    const { x, width } = chartLayoutRef.current;
    if (width === 0) return null;
    const relX = pageX - x;
    const idx = Math.round((relX / width) * (data.length - 1));
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
        if (idx !== null) setSelectedIdx(idx);
      },
      onPanResponderMove: (e) => {
        const idx = getIndexFromX(e.nativeEvent.pageX);
        if (idx !== null) setSelectedIdx(idx);
      },
      onPanResponderRelease: () => { setSelectedIdx(null); onInteractionEnd?.(); },
      onPanResponderTerminate: () => { setSelectedIdx(null); onInteractionEnd?.(); },
    })
  ).current;

  const displayVal = selectedIdx !== null ? data[selectedIdx] : null;

  return (
    <View>
      {/* Selected value tooltip */}
      <View style={{ height: 18, alignItems: 'center', marginBottom: 4 }}>
        {displayVal !== null && (
          <Text style={{ fontSize: 12, fontWeight: '700', color: lineColor }}>
            {formatValue ? formatValue(displayVal) : Math.round(displayVal)} — {labels[selectedIdx!]}
          </Text>
        )}
      </View>
      <View style={{ flexDirection: 'row' }}>
        {/* Y-axis labels */}
        <View style={{ width: 36, height, justifyContent: 'space-between', marginRight: 4 }}>
          {yTicks.map((tick, i) => (
            <Text key={i} style={{ fontSize: 9, color: theme.textSecondary, textAlign: 'right', lineHeight: 12 }}>
              {formatValue ? formatValue(tick) : tick}
            </Text>
          ))}
        </View>
        {/* Chart area with drag-to-scrub */}
        <View
          style={{ flex: 1, height, position: 'relative' }}
          onLayout={(e) => {
            e.target.measureInWindow((x, _y, width) => {
              chartLayoutRef.current = { x, width };
            });
          }}
          {...panResponder.panHandlers}
        >
          {/* Grid lines */}
          {yTicks.map((tick, i) => {
            const yPct = ((yMax - tick) / (yMax - yMin)) * 100;
            return (
              <View key={`grid-${i}`} style={{
                position: 'absolute', top: `${yPct}%`, left: 0, right: 0,
                height: 1, backgroundColor: theme.border, opacity: 0.4,
              }} />
            );
          })}
          {/* Gradient area fill under the line */}
          <LinearGradient
            colors={[fillColor + '35', fillColor + '08', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: '100%', borderRadius: 4,
            }}
          />
          {/* Connecting lines */}
          {data.length > 1 && data.slice(0, -1).map((val, i) => {
            const x1Pct = (i / (data.length - 1)) * 100;
            const y1Pct = ((yMax - val) / (yMax - yMin)) * 100;
            const x2Pct = ((i + 1) / (data.length - 1)) * 100;
            const y2Pct = ((yMax - data[i + 1]) / (yMax - yMin)) * 100;
            return (
              <View key={`line-${i}`} style={{
                position: 'absolute',
                left: `${x1Pct}%`, top: `${Math.min(y1Pct, y2Pct)}%`,
                width: `${x2Pct - x1Pct}%`,
                height: Math.max(Math.abs(y2Pct - y1Pct), 2),
                zIndex: 1,
              }}>
                <View style={{
                  position: 'absolute', left: 0, right: 0,
                  top: y2Pct >= y1Pct ? 0 : undefined,
                  bottom: y2Pct < y1Pct ? 0 : undefined,
                  height: 2, backgroundColor: lineColor, opacity: 0.7,
                }} />
              </View>
            );
          })}
          {/* Dots */}
          {data.map((val, i) => {
            const x = data.length === 1 ? 50 : (i / (data.length - 1)) * 100;
            const y = ((yMax - val) / (yMax - yMin)) * 100;
            const isSelected = i === selectedIdx;
            return (
              <View key={i} style={{
                position: 'absolute', left: `${x}%`, top: `${y}%`,
                width: isSelected ? 10 : dotSize, height: isSelected ? 10 : dotSize,
                borderRadius: isSelected ? 5 : dotSize / 2,
                backgroundColor: isSelected ? lineColor : lineColor,
                borderWidth: isSelected ? 2 : 0,
                borderColor: '#FFFFFF',
                marginLeft: isSelected ? -5 : -dotSize / 2,
                marginTop: isSelected ? -5 : -dotSize / 2,
                zIndex: 2,
              }} />
            );
          })}
          {/* Selection indicator line */}
          {selectedIdx !== null && (() => {
            const x = (selectedIdx / (data.length - 1)) * 100;
            return (
              <View style={{
                position: 'absolute', left: `${x}%`, top: 0, bottom: 0,
                width: 1, backgroundColor: lineColor, opacity: 0.4, zIndex: 1,
                marginLeft: -0.5,
              }} />
            );
          })()}
        </View>
      </View>
      {/* X-axis labels */}
      <View style={{ flexDirection: 'row', marginTop: 6, marginLeft: 40 }}>
        {labels.map((label, i) => (
          <View key={i} style={{ flex: 1, alignItems: i === 0 ? 'flex-start' : i === labels.length - 1 ? 'flex-end' : 'center' }}>
            <Text style={{
              fontSize: 9,
              fontWeight: i === selectedIdx ? '700' : '500',
              color: i === selectedIdx ? lineColor : theme.textSecondary,
            }} numberOfLines={1}>
              {label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Horizontal Bar Row (for muscle distribution) ───
function HorizontalBar({
  label,
  value,
  maxValue,
  barColor,
  theme,
  displayValue,
}: {
  label: string;
  value: number;
  maxValue: number;
  barColor: string;
  theme: any;
  displayValue: string;
}) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: theme.text }}>{label}</Text>
        <Text style={{ fontSize: 12, fontWeight: '500', color: theme.textSecondary }}>{displayValue}</Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.border, overflow: 'hidden' }}>
        <View style={{
          height: 8,
          width: `${Math.max(pct, 2)}%`,
          borderRadius: 4,
          backgroundColor: barColor,
        }} />
      </View>
    </View>
  );
}

// ─── Card wrapper ───
function StatCard({ title, theme, children }: { title: string; theme: any; children: React.ReactNode }) {
  return (
    <View style={{
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text, marginBottom: 12 }}>{title}</Text>
      {children}
    </View>
  );
}

export default function StatsScreen() {
  const { theme, weightUnit } = useSettings();
  const avatarColor = useUserStore((s) => s.avatarColor);
  const focusCardColor = avatarColor || '#F59E0B';

  const [activeTab, setActiveTab] = useState<'stats' | 'badges'>('stats');
  const [chartScrollLock, setChartScrollLock] = useState(false);
  const [strengthExpanded, setStrengthExpanded] = useState(false);
  const storeUserId = useUserStore((s) => s.userId);
  const userCreatedAt = useUserStore((s) => s.createdAt);
  const [userId, setUserId] = useState<string | null>(storeUserId);
  const [initialLoad, setInitialLoad] = useState(true); // only true until first data arrives

  // Raw cached data
  const [allLogs, setAllLogs] = useState<WorkoutLog[]>([]);
  const [streakDates, setStreakDates] = useState<string[]>([]);
  const [weightEntries, setWeightEntries] = useState<{ date: string; weight_kg: number }[]>([]);
  const cachedLogCount = useRef<number>(-1);

  const unitLabel = weightUnit === 'lbs' ? 'lbs' : 'kg';

  // ─── Fetch data once, then only re-fetch if log count changed ───
  const loadData = useCallback(async () => {
    try {
      // Use cached userId from store to avoid extra auth round-trip
      const uid = storeUserId || (await supabase.auth.getUser()).data.user?.id;
      if (!uid) { setInitialLoad(false); return; }
      if (!userId) setUserId(uid);

      // Quick count check to skip full re-fetch (check both workout_logs and body_stats)
      const [{ count }, { count: bsCount }] = await Promise.all([
        supabase.from('workout_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('body_stats').select('id', { count: 'exact', head: true }).eq('user_id', uid),
      ]);
      const totalCount = (count ?? 0) + (bsCount ?? 0);

      if (totalCount === cachedLogCount.current && allLogs.length > 0) {
        setInitialLoad(false);
        return; // No new data, skip re-fetch
      }
      cachedLogCount.current = totalCount;

      // Fetch last 60 days of full logs + 90 days of streak dates
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const [{ data: logs }, { data: sLogs }, { data: bodyStats }, { data: restCheckIns }] = await Promise.all([
        supabase
          .from('workout_logs')
          .select('id, day_name, exercises, duration_minutes, completed_at')
          .eq('user_id', uid)
          .gte('completed_at', dateKey(sixtyDaysAgo))
          .order('completed_at', { ascending: false }),
        supabase
          .from('workout_logs')
          .select('completed_at')
          .eq('user_id', uid)
          .gte('completed_at', dateKey(ninetyDaysAgo))
          .order('completed_at', { ascending: false }),
        supabase
          .from('body_stats')
          .select('date, weight_kg')
          .eq('user_id', uid)
          .not('weight_kg', 'is', null)
          .order('date', { ascending: true })
          .limit(90),
        supabase
          .from('activities')
          .select('date')
          .eq('user_id', uid)
          .eq('type', 'rest_check_in')
          .gte('date', dateKey(ninetyDaysAgo)),
      ]);

      const allWorkoutLogs = (logs ?? []) as WorkoutLog[];
      setAllLogs(allWorkoutLogs);
      // Hydrate badge stats from workout history (runs once)
      useBadgeStore.getState().hydrateFromLogs(
        allWorkoutLogs.map(l => ({ exercises: l.exercises as any, completed_at: l.completed_at ?? '' })),
        getExerciseCategories,
      );
      setWeightEntries(
        (bodyStats ?? [])
          .filter((e: any) => e.weight_kg != null)
          .map((e: any) => ({ date: e.date, weight_kg: Number(e.weight_kg) })),
      );
      const workoutDates = (sLogs ?? []).map((l: any) => l.completed_at?.split('T')[0]).filter(Boolean);
      const checkInDates = (restCheckIns ?? []).map((a: any) => a.date).filter(Boolean);
      setStreakDates([...new Set([...workoutDates, ...checkInDates])]);
      setInitialLoad(false);
    } catch {
      setInitialLoad(false);
    }
  }, [storeUserId]); // only re-create if userId changes

  // Fetch on mount (or when storeUserId becomes available). On focus, lightweight re-check.
  useEffect(() => { loadData(); }, [loadData]);
  useFocusEffect(useCallback(() => {
    // Lightweight re-check on tab focus
    if (cachedLogCount.current >= 0) loadData();
  }, [loadData]));

  // ═══════════════════════════════════════════════════════════
  // COMPUTED STATS (all memoized from cached allLogs)
  // ═══════════════════════════════════════════════════════════

  // ─── Streak ───
  const { streak, maxStreak } = useMemo(() => {
    const datesSet = new Set(streakDates);
    // Current streak
    let s = 0;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (!datesSet.has(dateKey(d))) d.setDate(d.getDate() - 1);
    while (datesSet.has(dateKey(d))) { s++; d.setDate(d.getDate() - 1); }

    // Best streak
    const sorted = Array.from(datesSet).sort();
    let best = 0, run = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1] + 'T12:00:00');
      const curr = new Date(sorted[i] + 'T12:00:00');
      if (Math.round((curr.getTime() - prev.getTime()) / 86400000) === 1) run++;
      else { best = Math.max(best, run); run = 1; }
    }
    return { streak: s, maxStreak: Math.max(best, run) };
  }, [streakDates]);

  // ─── 8-Week Volume Trend ───
  const weeklyVolumeTrend = useMemo(() => {
    const now = new Date();
    const thisSunday = getSunday(now);
    const weeks: { label: string; volume: number }[] = [];

    for (let w = 7; w >= 0; w--) {
      const weekStart = new Date(thisSunday);
      weekStart.setDate(weekStart.getDate() - w * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6); // Saturday
      const start = dateKey(weekStart);
      const end = dateKey(weekEnd);

      const vol = allLogs
        .filter(l => {
          const dk = l.completed_at?.split('T')[0];
          return dk && dk >= start && dk <= end;
        })
        .reduce((sum, l) => sum + logVolume(l), 0);

      weeks.push({ label: shortDate(weekStart), volume: vol });
    }
    return weeks;
  }, [allLogs]);

  // Current week volume + delta vs last week (only show if week is complete or current >= last)
  const { weekVolume, volDelta } = useMemo(() => {
    const curr = weeklyVolumeTrend[weeklyVolumeTrend.length - 1]?.volume ?? 0;
    const prev = weeklyVolumeTrend[weeklyVolumeTrend.length - 2]?.volume ?? 0;

    // Count workouts in current vs previous week to avoid unfair partial-week comparison
    const now = new Date();
    const thisSunday = getSunday(now);
    const prevSunday = new Date(thisSunday);
    prevSunday.setDate(prevSunday.getDate() - 7);
    const currStart = dateKey(thisSunday);
    const prevStart = dateKey(prevSunday);
    const prevEnd = dateKey(new Date(prevSunday.getTime() + 6 * 86400000));

    const currWorkouts = allLogs.filter(l => {
      const dk = l.completed_at?.split('T')[0];
      return dk && dk >= currStart;
    }).length;
    const prevWorkouts = allLogs.filter(l => {
      const dk = l.completed_at?.split('T')[0];
      return dk && dk >= prevStart && dk <= prevEnd;
    }).length;

    // Only show delta if current week has at least as many workouts as last week
    const isFairComparison = currWorkouts >= prevWorkouts && prevWorkouts > 0;

    return {
      weekVolume: Math.round(curr),
      volDelta: prev > 0 && isFairComparison ? ((curr - prev) / prev) * 100 : null,
    };
  }, [weeklyVolumeTrend, allLogs]);

  // ─── 3-week daily volume data (for VolumeChart) ───
  const volumeChartData = useMemo((): VolumeChartData[] => {
    const weekDates = getWeekDates();

    const buildDailyVol = (mondayDate: Date): { day: string; volume: number; name: string }[] => {
      const days = Array.from({ length: 7 }, (_, i) => {
        const dd = new Date(mondayDate);
        dd.setDate(dd.getDate() + i);
        return { day: dateKey(dd), volume: 0, name: '' };
      });
      allLogs.forEach(log => {
        const logDate = log.completed_at?.split('T')[0];
        const entry = days.find(dd => dd.day === logDate);
        if (entry) {
          entry.volume += Math.round(logVolume(log));
          if (!entry.name && log.day_name) entry.name = log.day_name;
        }
      });
      // Remove rest days (no volume) to eliminate gaps
      return days.filter(d => d.volume > 0);
    };

    const w1Mon = new Date(weekDates[0]);
    w1Mon.setDate(w1Mon.getDate() - 14);
    const lastWeekMon = new Date(weekDates[0]);
    lastWeekMon.setDate(lastWeekMon.getDate() - 7);

    const weeks = [
      buildDailyVol(w1Mon),
      buildDailyVol(lastWeekMon),
      buildDailyVol(weekDates[0]),
    ];

    // Flatten into VolumeChartData[] — volumes are already in user's unit (stored as-entered)
    return weeks.flat().map(d => {
      const dd = new Date(d.day + 'T12:00:00');
      const label = `${dd.getMonth() + 1}/${dd.getDate()}`;
      return { volume: d.volume, date: d.day, label };
    });
  }, [allLogs]);

  // ─── Workout Frequency (8 weeks) ───
  const { frequencyData, avgFrequency } = useMemo(() => {
    const now = new Date();
    const thisSunday = getSunday(now);
    const joinDate = userCreatedAt ? dateKey(new Date(userCreatedAt)) : null;
    const data: { label: string; count: number }[] = [];
    let total = 0;

    for (let w = 7; w >= 0; w--) {
      const weekStart = new Date(thisSunday);
      weekStart.setDate(weekStart.getDate() - w * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6); // Saturday
      const start = dateKey(weekStart);
      const end = dateKey(weekEnd);

      // Skip weeks before user joined
      if (joinDate && end < joinDate) continue;

      const count = allLogs.filter(l => {
        const dk = l.completed_at?.split('T')[0];
        return dk && dk >= start && dk <= end;
      }).length;

      data.push({ label: shortDate(weekStart), count });
      total += count;
    }

    return { frequencyData: data, avgFrequency: data.length > 0 ? (total / data.length).toFixed(1) : '0' };
  }, [allLogs, userCreatedAt]);

  // ─── Muscle Group Distribution ───
  const muscleDistribution = useMemo(() => {
    const map = new Map<string, number>();
    for (const log of allLogs) {
      for (const ex of log.exercises as LoggedExercise[]) {
        const cat = getExerciseCategory(ex.name);
        if (!cat) continue;
        const vol = ex.sets
          .filter(s => s.completed && s.weight != null)
          .reduce((sum, s) => sum + (s.weight ?? 0) * s.reps, 0);
        map.set(cat, (map.get(cat) ?? 0) + vol);
      }
    }
    const totalVol = Array.from(map.values()).reduce((a, b) => a + b, 0);
    return Array.from(map.entries())
      .map(([category, volume]) => ({
        category,
        volume,
        pct: totalVol > 0 ? Math.round((volume / totalVol) * 100) : 0,
      }))
      .sort((a, b) => b.volume - a.volume);
  }, [allLogs]);

  // ─── Muscle Progress (e1RM % change: last 2 weeks vs 2-6 weeks ago) ───
  const muscleProgress = useMemo(() => {
    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
    const sixWeeksAgo = new Date(now.getTime() - 42 * 86400000);

    const recentBest = new Map<string, number>(); // muscle → best e1RM (recent)
    const priorBest = new Map<string, number>();  // muscle → best e1RM (prior)

    for (const log of allLogs) {
      const logDate = new Date(log.completed_at ?? '');
      const isRecent = logDate >= twoWeeksAgo;
      const isPrior = logDate >= sixWeeksAgo && logDate < twoWeeksAgo;
      if (!isRecent && !isPrior) continue;

      for (const ex of log.exercises as LoggedExercise[]) {
        const cat = getExerciseCategory(ex.name);
        if (!cat) continue;

        for (const s of ex.sets) {
          if (!s.completed || !s.weight || s.weight <= 0 || s.reps <= 0) continue;
          // Brzycki e1RM formula
          const e1rm = s.reps === 1 ? s.weight : s.weight * (36 / (37 - s.reps));
          const map = isRecent ? recentBest : priorBest;
          const current = map.get(cat) ?? 0;
          if (e1rm > current) map.set(cat, e1rm);
        }
      }
    }

    // Build comparison — only include muscles that appear in both periods
    const results: { category: string; recentE1rm: number; priorE1rm: number; pctChange: number }[] = [];
    for (const [cat, recent] of recentBest.entries()) {
      const prior = priorBest.get(cat);
      if (!prior || prior <= 0) continue;
      const pctChange = ((recent - prior) / prior) * 100;
      results.push({ category: cat, recentE1rm: Math.round(recent), priorE1rm: Math.round(prior), pctChange: Math.round(pctChange * 10) / 10 });
    }

    return results.sort((a, b) => b.pctChange - a.pctChange);
  }, [allLogs]);

  // ─── Session Duration Trend (8 weeks, only after user joined) ───
  const durationTrend = useMemo(() => {
    const now = new Date();
    const thisSunday = getSunday(now);
    const joinDate = userCreatedAt ? dateKey(new Date(userCreatedAt)) : null;
    const weeks: { label: string; avgMin: number }[] = [];

    for (let w = 7; w >= 0; w--) {
      const weekStart = new Date(thisSunday);
      weekStart.setDate(weekStart.getDate() - w * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6); // Saturday
      const start = dateKey(weekStart);
      const end = dateKey(weekEnd);

      // Skip weeks entirely before the user joined
      if (joinDate && end < joinDate) continue;

      const weekLogs = allLogs.filter(l => {
        const dk = l.completed_at?.split('T')[0];
        return dk && dk >= start && dk <= end;
      });

      const avg = weekLogs.length > 0
        ? weekLogs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0) / weekLogs.length
        : 0;

      weeks.push({ label: shortDate(weekStart), avgMin: Math.round(avg) });
    }
    return weeks;
  }, [allLogs, userCreatedAt]);

  // ─── Weight Trend (from body_stats) ───
  const weightTrend = useMemo(() => {
    if (weightEntries.length === 0) return { data: [] as number[], labels: [] as string[], current: 0, change: null as number | null };
    // Show last 30 entries max, convert units
    const entries = weightEntries.slice(-30);
    const data = entries.map(e =>
      weightUnit === 'lbs' ? Math.round(e.weight_kg * 2.205 * 10) / 10 : Math.round(e.weight_kg * 10) / 10,
    );
    // Labels: show ~5 evenly spaced date labels
    const labelCount = Math.min(5, entries.length);
    const labels = entries.map((e, i) => {
      if (entries.length <= 5) {
        const d = new Date(e.date + 'T12:00:00');
        return `${d.getMonth() + 1}/${d.getDate()}`;
      }
      const interval = Math.floor((entries.length - 1) / (labelCount - 1));
      if (i % interval === 0 || i === entries.length - 1) {
        const d = new Date(e.date + 'T12:00:00');
        return `${d.getMonth() + 1}/${d.getDate()}`;
      }
      return '';
    });
    const current = data[data.length - 1];
    const first = data[0];
    const change = data.length >= 2 ? Math.round((current - first) * 10) / 10 : null;
    return { data, labels, current, change };
  }, [weightEntries, weightUnit]);

  // ─── Muscle distribution colors (vibrant) ───
  const muscleColors = [
    '#3B82F6', '#EF4444', '#22C55E', '#F59E0B', '#8B5CF6',
    '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <AppHeader />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12 }}>
        <Text allowFontScaling style={{ fontSize: 28, fontWeight: '800', color: theme.text }}>
          {activeTab === 'stats' ? 'Stats' : 'Achievements'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Pressable
            onPress={() => { animateLayout(); setActiveTab('stats'); }}
            hitSlop={8}
          >
            <Ionicons name="analytics-outline" size={22} color={activeTab === 'stats' ? focusCardColor : theme.chrome} />
          </Pressable>
          <Pressable
            onPress={() => { animateLayout(); setActiveTab('badges'); }}
            hitSlop={8}
          >
            <Ionicons name="trophy-outline" size={22} color={activeTab === 'badges' ? focusCardColor : theme.chrome} />
          </Pressable>
        </View>
      </View>

      {initialLoad && allLogs.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={focusCardColor} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          scrollEnabled={!chartScrollLock}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'stats' ? (
            <View style={{ gap: 12 }}>

              {/* ─── Streak ─── */}
              <StreakRing streak={streak} maxStreak={maxStreak} size="compact" color={focusCardColor} />

              {/* ─── 3-Week Daily Volume ─── */}
              {volumeChartData.length > 0 && (
                <StatCard title="Volume Trend" theme={theme}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, marginTop: -4 }}>
                    <Text style={{ fontSize: 10, color: theme.textSecondary }}>
                      daily volume · 3 weeks
                    </Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text, fontVariant: ['tabular-nums'] }}>
                        {formatNumber(weekVolume)} <Text style={{ fontSize: 11, fontWeight: '500', color: theme.textSecondary }}>{unitLabel}</Text>
                      </Text>
                      <Text style={{ fontSize: 10, color: theme.textSecondary, marginTop: 1 }}>
                        total volume this week
                      </Text>
                      {volDelta != null && (
                        <Text style={{
                          fontSize: 11,
                          fontWeight: '600',
                          color: volDelta >= 0 ? '#22C55E' : '#EF4444',
                          marginTop: 2,
                        }}>
                          {volDelta >= 0 ? '+' : ''}{Math.round(volDelta)}% vs last week
                        </Text>
                      )}
                    </View>
                  </View>
                  <VolumeChart
                    data={volumeChartData}
                    theme={theme}
                    avatarColor={focusCardColor}
                    currentIndex={volumeChartData.length - 1}
                    unitLabel={unitLabel}
                    onInteractionStart={() => setChartScrollLock(true)}
                    onInteractionEnd={() => setChartScrollLock(false)}
                  />
                </StatCard>
              )}

              {/* ─── Strength Profile (Radar) ─── */}
              {muscleDistribution.length > 0 && (() => {
                const radarData = groupForRadar(muscleDistribution);
                const totalVol = muscleDistribution.reduce((s, m) => s + m.volume, 0);
                const maxPct = Math.max(...muscleDistribution.map(m => totalVol > 0 ? (m.volume / totalVol) * 100 : 0), 1);
                return radarData.length >= 3 ? (
                  <StatCard title="Strength Profile" theme={theme}>
                    <Text style={{ fontSize: 10, color: theme.textSecondary, marginBottom: 4, marginTop: -4 }}>
                      volume balance · last 60 days
                    </Text>
                    <StrengthRadar
                      data={radarData}
                      size={280}
                      accentColor={focusCardColor}
                      theme={theme}
                    />
                    {/* Expander toggle */}
                    <Pressable
                      onPress={() => { animateLayout(); setStrengthExpanded(prev => !prev); }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        paddingVertical: 8,
                        marginTop: 4,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary }}>
                        {strengthExpanded ? 'Hide Breakdown' : 'View Breakdown'}
                      </Text>
                      <Ionicons
                        name={strengthExpanded ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={theme.textSecondary}
                      />
                    </Pressable>
                    {/* Expanded horizontal bar breakdown */}
                    {strengthExpanded && (
                      <View style={{ marginTop: 8 }}>
                        {muscleDistribution.filter(m => m.volume > 0).map((m, i) => {
                          const pct = totalVol > 0 ? Math.round((m.volume / totalVol) * 100) : 0;
                          const barWidth = maxPct > 0 ? Math.max((pct / maxPct) * 100, 3) : 3;
                          return (
                            <View key={m.category} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                              <Text style={{ fontSize: 12, fontWeight: '600', color: theme.text, width: 80 }} numberOfLines={1}>
                                {m.category}
                              </Text>
                              <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: theme.border, overflow: 'hidden', marginHorizontal: 10 }}>
                                <View style={{
                                  height: 8,
                                  width: `${barWidth}%`,
                                  borderRadius: 4,
                                  backgroundColor: muscleColors[i % muscleColors.length],
                                }} />
                              </View>
                              <Text style={{ fontSize: 11, fontWeight: '500', color: theme.textSecondary, width: 32, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
                                {pct}%
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </StatCard>
                ) : null;
              })()}

              {/* ─── Muscle Progress (e1RM % change) ─── */}
              {muscleProgress.length > 0 && (
                <StatCard title="Muscle Progress" theme={theme}>
                  <Text style={{ fontSize: 10, color: theme.textSecondary, marginBottom: 14, marginTop: -4 }}>
                    estimated 1RM change · last 2 wks vs prior 4 wks
                  </Text>
                  {muscleProgress.map((m) => {
                    const isPositive = m.pctChange > 2;
                    const isNegative = m.pctChange < -2;
                    const color = isPositive ? '#22C55E' : isNegative ? '#EF4444' : '#F59E0B';
                    const icon = isPositive ? 'trending-up' : isNegative ? 'trending-down' : 'remove';
                    return (
                      <View key={m.category} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginRight: 10 }} />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text, flex: 1 }}>{m.category}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name={icon as any} size={14} color={color} />
                          <Text style={{ fontSize: 13, fontWeight: '700', color, fontVariant: ['tabular-nums'], minWidth: 45, textAlign: 'right' }}>
                            {m.pctChange > 0 ? '+' : ''}{m.pctChange}%
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </StatCard>
              )}

              {/* ─── Workout Frequency (8 weeks) ─── */}
              <StatCard title="Workout Frequency" theme={theme}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, marginTop: -4 }}>
                  <Text style={{ fontSize: 10, color: theme.textSecondary }}>
                    workouts per week
                  </Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>
                    {avgFrequency}<Text style={{ fontSize: 11, fontWeight: '500', color: theme.textSecondary }}> avg/wk</Text>
                  </Text>
                </View>
                <BarChart
                  data={frequencyData.map(w => w.count)}
                  labels={frequencyData.map(w => w.label)}
                  barColor="#3B82F6"
                  theme={theme}
                  height={80}
                  onInteractionStart={() => setChartScrollLock(true)}
                  onInteractionEnd={() => setChartScrollLock(false)}
                  formatValue={(v) => `${Math.round(v)} workouts`}
                />
              </StatCard>

              {/* ─── Session Duration Trend (8 weeks) ─── */}
              <StatCard title="Avg Session Duration" theme={theme}>
                {(() => {
                  const nonZero = durationTrend.filter(w => w.avgMin > 0);
                  const overallAvg = nonZero.length > 0
                    ? Math.round(nonZero.reduce((s, w) => s + w.avgMin, 0) / nonZero.length)
                    : 0;
                  return (
                    <>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, marginTop: -4 }}>
                        <Text style={{ fontSize: 10, color: theme.textSecondary }}>
                          minutes per session
                        </Text>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>
                          {overallAvg}<Text style={{ fontSize: 11, fontWeight: '500', color: theme.textSecondary }}> min</Text>
                        </Text>
                      </View>
                      <BarChart
                        data={durationTrend.map(w => w.avgMin)}
                        labels={durationTrend.map(w => w.label)}
                        barColor="#14B8A6"
                        theme={theme}
                        height={80}
                        onInteractionStart={() => setChartScrollLock(true)}
                        onInteractionEnd={() => setChartScrollLock(false)}
                        formatValue={(v) => `${Math.round(v)} min`}
                      />
                    </>
                  );
                })()}
              </StatCard>

              {/* ─── Weight Trend ─── */}
              {weightTrend.data.length >= 1 && (
                <StatCard title="Weigh-In Trend" theme={theme}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, marginTop: -4 }}>
                    <Text style={{ fontSize: 10, color: theme.textSecondary }}>
                      last {weightTrend.data.length} entries ({unitLabel})
                    </Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text, fontVariant: ['tabular-nums'] }}>
                        {weightTrend.current}
                        <Text style={{ fontSize: 11, fontWeight: '500', color: theme.textSecondary }}> {unitLabel}</Text>
                      </Text>
                      {weightTrend.change !== null && (
                        <Text style={{
                          fontSize: 11,
                          fontWeight: '600',
                          color: weightTrend.change <= 0 ? '#22C55E' : '#EF4444',
                        }}>
                          {weightTrend.change > 0 ? '+' : ''}{weightTrend.change} {unitLabel}
                        </Text>
                      )}
                    </View>
                  </View>
                  <LineChart
                    data={weightTrend.data}
                    labels={weightTrend.labels}
                    lineColor="#8B5CF6"
                    gradientColor={focusCardColor}
                    theme={theme}
                    height={100}
                    formatValue={(v) => `${Math.round(v)}`}
                    onInteractionStart={() => setChartScrollLock(true)}
                    onInteractionEnd={() => setChartScrollLock(false)}
                  />
                </StatCard>
              )}

              {/* ─── Personal Records ─── */}
              {userId && (
                <PersonalRecordsSection userId={userId} accentColor={focusCardColor} />
              )}

            </View>
          ) : (
            <BadgesTab />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
