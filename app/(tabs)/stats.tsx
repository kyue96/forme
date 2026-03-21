import { useCallback, useState } from 'react';
import {
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
import { animateLayout } from '@/lib/utils';
import { dateKey, getWeekDates } from '@/components/WeeklyCalendar';

interface WorkoutLog {
  id: string;
  day_name: string;
  exercises: LoggedExercise[];
  duration_minutes: number;
  completed_at: string;
}

export default function StatsScreen() {
  const { theme, weightUnit } = useSettings();
  const avatarColor = useUserStore((s) => s.avatarColor);
  const focusCardColor = avatarColor || '#F59E0B';

  const [activeTab, setActiveTab] = useState<'stats' | 'badges'>('stats');

  // Stats data
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [weekVolume, setWeekVolume] = useState(0);
  const [weeklyVolData, setWeeklyVolData] = useState<[any[], any[], any[]]>([[], [], []]);
  const [volDelta, setVolDelta] = useState<number | null>(null);

  const loadAllData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const weekDates = getWeekDates();
      const weekStart = dateKey(weekDates[0]);
      const weekEnd = dateKey(weekDates[6]);
      const w1Mon = new Date(weekDates[0]); w1Mon.setDate(w1Mon.getDate() - 14);

      const [{ data: recentLogs }, { data: streakLogs }] = await Promise.all([
        supabase
          .from('workout_logs')
          .select('id, day_name, exercises, duration_minutes, completed_at')
          .eq('user_id', user.id)
          .gte('completed_at', dateKey(w1Mon))
          .order('completed_at', { ascending: false }),
        supabase
          .from('workout_logs')
          .select('completed_at')
          .eq('user_id', user.id)
          .gte('completed_at', (() => { const d = new Date(); d.setDate(d.getDate() - 60); return dateKey(d); })())
          .order('completed_at', { ascending: false }),
      ]);

      const allLogs = (recentLogs ?? []) as WorkoutLog[];

      // --- Streak ---
      const streakDatesList = (streakLogs ?? []).map((l: any) => l.completed_at?.split('T')[0]).filter(Boolean);
      const streakDatesSet = new Set(streakDatesList);

      let s = 0;
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      if (!streakDatesSet.has(dateKey(d))) d.setDate(d.getDate() - 1);
      while (streakDatesSet.has(dateKey(d))) { s++; d.setDate(d.getDate() - 1); }
      setStreak(s);

      const sorted = Array.from(streakDatesSet).sort();
      let best = 0, run = 1;
      for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1] + 'T12:00:00');
        const curr = new Date(sorted[i] + 'T12:00:00');
        if (Math.round((curr.getTime() - prev.getTime()) / 86400000) === 1) { run++; } else { best = Math.max(best, run); run = 1; }
      }
      setMaxStreak(Math.max(best, run));

      // --- Weekly volume (3 weeks) ---
      const lastWeekMon = new Date(weekDates[0]); lastWeekMon.setDate(lastWeekMon.getDate() - 7);
      const lastWeekSun = new Date(weekDates[0]); lastWeekSun.setDate(lastWeekSun.getDate() - 1);

      const filterByRange = (start: string, end: string) =>
        allLogs.filter((l) => {
          const dk = l.completed_at?.split('T')[0];
          return dk && dk >= start && dk <= end;
        });

      const thisWeekLogs = filterByRange(weekStart, weekEnd);
      const lastWeekLogs = filterByRange(dateKey(lastWeekMon), dateKey(lastWeekSun));
      const w1Logs = filterByRange(dateKey(w1Mon), dateKey(new Date(weekDates[0].getTime() - 8 * 86400000)));

      const calcVolume = (logsList: WorkoutLog[]) =>
        logsList.reduce((total, log) => {
          const exs = log.exercises as LoggedExercise[];
          return total + exs.reduce((s2, ex) =>
            s2 + ex.sets.filter(se => se.completed && se.weight != null).reduce((v, se) => v + (se.weight ?? 0) * se.reps, 0), 0);
        }, 0);

      const calcLogVolume = (log: WorkoutLog) => {
        const exs = log.exercises as LoggedExercise[];
        return exs.reduce((s2, ex) =>
          s2 + ex.sets.filter(se => se.completed && se.weight != null).reduce((v, se) => v + (se.weight ?? 0) * se.reps, 0), 0);
      };

      const thisVol = calcVolume(thisWeekLogs);
      const lastVol = calcVolume(lastWeekLogs);
      const conv = weightUnit === 'lbs' ? 2.205 : 1;
      setWeekVolume(Math.round(thisVol * conv));
      setVolDelta(lastVol > 0 ? ((thisVol - lastVol) / lastVol) * 100 : null);

      const buildDailyVol = (logsList: WorkoutLog[], mondayDate: Date) => {
        const days = Array.from({ length: 7 }, (_, i) => {
          const dd = new Date(mondayDate);
          dd.setDate(dd.getDate() + i);
          return { day: dateKey(dd), volume: 0 };
        });
        logsList.forEach((log) => {
          const logDate = log.completed_at?.split('T')[0];
          const entry = days.find((dd) => dd.day === logDate);
          if (entry) entry.volume += Math.round(calcLogVolume(log) * conv);
        });
        return days;
      };

      setWeeklyVolData([
        buildDailyVol(w1Logs, w1Mon),
        buildDailyVol(lastWeekLogs, lastWeekMon),
        buildDailyVol(thisWeekLogs, weekDates[0]),
      ]);
    } catch {}
  }, [weightUnit]);

  useFocusEffect(useCallback(() => { loadAllData(); }, [loadAllData]));

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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'stats' ? (
          <View style={{ gap: 12 }}>
            <StreakRing streak={streak} maxStreak={maxStreak} size="large" color={focusCardColor} />
            {weeklyVolData[2].length > 0 && (
              <WeeklyVolumeCard
                weeks={weeklyVolData}
                totalVolume={weekVolume}
                deltaPercent={volDelta}
                accentColor={focusCardColor}
              />
            )}

          </View>
        ) : (
          <BadgesTab />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
