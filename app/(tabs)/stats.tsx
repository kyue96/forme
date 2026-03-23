import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { BadgesTab } from '@/components/BadgesTab';
import { StreakRing } from '@/components/StreakRing';
import { WeeklyVolumeCard } from '@/components/WeeklyVolumeCard';
import { AppHeader } from '@/components/AppHeader';

import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';
import { useUserStore } from '@/lib/user-store';
import { LoggedExercise } from '@/lib/types';
import { animateLayout, formatNumber } from '@/lib/utils';
import { PersonalRecordsSection } from '@/components/PersonalRecordsSection';
import { dateKey, getWeekDates } from '@/components/WeeklyCalendar';
import { getExerciseCategory } from '@/lib/exercise-utils';

interface WorkoutLog {
  id: string;
  day_name: string;
  exercises: LoggedExercise[];
  duration_minutes: number;
  completed_at: string;
}

// ─── Helper: get Monday of the week containing a date ───
function getMonday(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Sunday → go back 6
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

// ─── Helper: format date as "Mar 10" ───
function shortDate(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
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
  yAxisLabel,
}: {
  data: number[];
  labels: string[];
  barColor: string;
  theme: any;
  height?: number;
  yAxisLabel?: string;
}) {
  const maxVal = Math.max(...data, 1);
  return (
    <View>
      {yAxisLabel && (
        <Text style={{ fontSize: 8, color: theme.textSecondary, fontWeight: '600', marginBottom: 2 }}>
          {yAxisLabel}
        </Text>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 4 }}>
        {data.map((val, i) => {
          const barH = maxVal > 0 ? Math.max((val / maxVal) * height, val > 0 ? 4 : 0) : 0;
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height }}>
              <View style={{
                width: '70%',
                height: barH,
                backgroundColor: barColor,
                borderRadius: 4,
                opacity: val > 0 ? 0.9 : 0.15,
              }} />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 6, gap: 4 }}>
        {labels.map((label, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 9, fontWeight: '500', color: theme.textSecondary }} numberOfLines={1}>
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
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Raw cached data
  const [allLogs, setAllLogs] = useState<WorkoutLog[]>([]);
  const [streakDates, setStreakDates] = useState<string[]>([]);
  const cachedLogCount = useRef<number>(-1);

  const convert = useCallback(
    (kg: number) => weightUnit === 'lbs' ? Math.round(kg * 2.205) : Math.round(kg),
    [weightUnit],
  );
  const unitLabel = weightUnit === 'lbs' ? 'lbs' : 'kg';

  // ─── Fetch data once, then only re-fetch if log count changed ───
  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Quick count check to skip full re-fetch
      const { count } = await supabase
        .from('workout_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (count === cachedLogCount.current && allLogs.length > 0) {
        setLoading(false);
        return; // No new logs, skip re-fetch
      }
      cachedLogCount.current = count ?? 0;

      // Fetch last 60 days of full logs + 90 days of streak dates
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const [{ data: logs }, { data: sLogs }] = await Promise.all([
        supabase
          .from('workout_logs')
          .select('id, day_name, exercises, duration_minutes, completed_at')
          .eq('user_id', user.id)
          .gte('completed_at', dateKey(sixtyDaysAgo))
          .order('completed_at', { ascending: false }),
        supabase
          .from('workout_logs')
          .select('completed_at')
          .eq('user_id', user.id)
          .gte('completed_at', dateKey(ninetyDaysAgo))
          .order('completed_at', { ascending: false }),
      ]);

      setAllLogs((logs ?? []) as WorkoutLog[]);
      setStreakDates(
        (sLogs ?? []).map((l: any) => l.completed_at?.split('T')[0]).filter(Boolean),
      );
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, []); // no deps — we use cachedLogCount ref for staleness check

  // Fetch on mount only. On focus, do a lightweight count check.
  useEffect(() => { loadData(); }, []);
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
    const thisMonday = getMonday(now);
    const weeks: { label: string; volume: number }[] = [];

    for (let w = 7; w >= 0; w--) {
      const monday = new Date(thisMonday);
      monday.setDate(monday.getDate() - w * 7);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      const start = dateKey(monday);
      const end = dateKey(sunday);

      const vol = allLogs
        .filter(l => {
          const dk = l.completed_at?.split('T')[0];
          return dk && dk >= start && dk <= end;
        })
        .reduce((sum, l) => sum + logVolume(l), 0);

      weeks.push({ label: shortDate(monday), volume: vol });
    }
    return weeks;
  }, [allLogs]);

  // Current week volume + delta vs last week
  const { weekVolume, volDelta } = useMemo(() => {
    const curr = weeklyVolumeTrend[weeklyVolumeTrend.length - 1]?.volume ?? 0;
    const prev = weeklyVolumeTrend[weeklyVolumeTrend.length - 2]?.volume ?? 0;
    return {
      weekVolume: Math.round(curr),
      volDelta: prev > 0 ? ((curr - prev) / prev) * 100 : null,
    };
  }, [weeklyVolumeTrend]);

  // ─── 3-week daily volume data (for existing WeeklyVolumeCard) ───
  const weeklyVolData = useMemo(() => {
    const weekDates = getWeekDates();

    const buildDailyVol = (mondayDate: Date): { day: string; volume: number }[] => {
      const days = Array.from({ length: 7 }, (_, i) => {
        const dd = new Date(mondayDate);
        dd.setDate(dd.getDate() + i);
        return { day: dateKey(dd), volume: 0 };
      });
      allLogs.forEach(log => {
        const logDate = log.completed_at?.split('T')[0];
        const entry = days.find(dd => dd.day === logDate);
        if (entry) entry.volume += Math.round(logVolume(log));
      });
      return days;
    };

    const w1Mon = new Date(weekDates[0]);
    w1Mon.setDate(w1Mon.getDate() - 14);
    const lastWeekMon = new Date(weekDates[0]);
    lastWeekMon.setDate(lastWeekMon.getDate() - 7);

    return [
      buildDailyVol(w1Mon),
      buildDailyVol(lastWeekMon),
      buildDailyVol(weekDates[0]),
    ] as [any[], any[], any[]];
  }, [allLogs]);

  // ─── Workout Frequency (8 weeks) ───
  const { frequencyData, avgFrequency } = useMemo(() => {
    const now = new Date();
    const thisMonday = getMonday(now);
    const data: { label: string; count: number }[] = [];
    let total = 0;

    for (let w = 7; w >= 0; w--) {
      const monday = new Date(thisMonday);
      monday.setDate(monday.getDate() - w * 7);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      const start = dateKey(monday);
      const end = dateKey(sunday);

      const count = allLogs.filter(l => {
        const dk = l.completed_at?.split('T')[0];
        return dk && dk >= start && dk <= end;
      }).length;

      data.push({ label: shortDate(monday), count });
      total += count;
    }

    return { frequencyData: data, avgFrequency: data.length > 0 ? (total / data.length).toFixed(1) : '0' };
  }, [allLogs]);

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

  // ─── Session Duration Trend (8 weeks) ───
  const durationTrend = useMemo(() => {
    const now = new Date();
    const thisMonday = getMonday(now);
    const weeks: { label: string; avgMin: number }[] = [];

    for (let w = 7; w >= 0; w--) {
      const monday = new Date(thisMonday);
      monday.setDate(monday.getDate() - w * 7);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      const start = dateKey(monday);
      const end = dateKey(sunday);

      const weekLogs = allLogs.filter(l => {
        const dk = l.completed_at?.split('T')[0];
        return dk && dk >= start && dk <= end;
      });

      const avg = weekLogs.length > 0
        ? weekLogs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0) / weekLogs.length
        : 0;

      weeks.push({ label: shortDate(monday), avgMin: Math.round(avg) });
    }
    return weeks;
  }, [allLogs]);

  // ─── Muscle distribution colors ───
  const muscleColors = [
    '#F59E0B', '#3B82F6', '#22C55E', '#EF4444', '#A855F7',
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

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={focusCardColor} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'stats' ? (
            <View style={{ gap: 12 }}>

              {/* ─── Streak Ring ─── */}
              <StreakRing streak={streak} maxStreak={maxStreak} size="large" color={focusCardColor} />

              {/* ─── 3-Week Daily Volume (existing) ─── */}
              {weeklyVolData[2].length > 0 && (
                <WeeklyVolumeCard
                  weeks={weeklyVolData}
                  totalVolume={convert(weekVolume)}
                  deltaPercent={volDelta}
                  accentColor={focusCardColor}
                />
              )}

              {/* ─── Weekly Volume Trend (8 weeks) ─── */}
              <StatCard title="weekly volume trend" theme={theme}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, marginTop: -4 }}>
                  <Text style={{ fontSize: 10, color: theme.textSecondary }}>
                    last 8 weeks ({unitLabel})
                  </Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>
                      {formatNumber(convert(weekVolume))}
                    </Text>
                    {volDelta != null && (
                      <Text style={{
                        fontSize: 11,
                        fontWeight: '600',
                        color: volDelta >= 0 ? '#22C55E' : '#EF4444',
                      }}>
                        {volDelta >= 0 ? '+' : ''}{Math.round(volDelta)}% vs last week
                      </Text>
                    )}
                  </View>
                </View>
                <BarChart
                  data={weeklyVolumeTrend.map(w => convert(Math.round(w.volume)))}
                  labels={weeklyVolumeTrend.map(w => w.label)}
                  barColor={focusCardColor}
                  theme={theme}
                  height={100}
                  yAxisLabel={unitLabel}
                />
              </StatCard>

              {/* ─── Workout Frequency (8 weeks) ─── */}
              <StatCard title="workout frequency" theme={theme}>
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
                />
              </StatCard>

              {/* ─── Muscle Group Distribution ─── */}
              {muscleDistribution.length > 0 && (
                <StatCard title="muscle group distribution" theme={theme}>
                  <Text style={{ fontSize: 10, color: theme.textSecondary, marginBottom: 12, marginTop: -4 }}>
                    % of total volume
                  </Text>
                  {muscleDistribution.slice(0, 8).map((m, i) => (
                    <HorizontalBar
                      key={m.category}
                      label={m.category}
                      value={m.volume}
                      maxValue={muscleDistribution[0].volume}
                      barColor={muscleColors[i % muscleColors.length]}
                      theme={theme}
                      displayValue={`${m.pct}%`}
                    />
                  ))}
                </StatCard>
              )}

              {/* ─── Session Duration Trend (8 weeks) ─── */}
              <StatCard title="avg session duration" theme={theme}>
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
                      />
                    </>
                  );
                })()}
              </StatCard>

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
