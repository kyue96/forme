import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';
import { useUserStore } from '@/lib/user-store';
import { usePlan } from '@/lib/plan-context';
import { ProGateSheet } from '@/components/ProGateSheet';
import { LoggedExercise, LoggedSet } from '@/lib/types';

function dateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

interface WorkoutLog {
  id: string;
  day_name: string;
  exercises: LoggedExercise[];
  duration_minutes: number;
  completed_at: string;
}

export default function HistoryScreen() {
  const router = useRouter();
  const { theme, weightUnit } = useSettings();
  const { plan } = usePlan();
  const isPro = useUserStore((s) => s.isPro);
  const [showProGate, setShowProGate] = useState(false);

  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [logDates, setLogDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayLogs, setDayLogs] = useState<WorkoutLog[]>([]);
  const [dayLogsLoading, setDayLogsLoading] = useState(false);

  const [editingLog, setEditingLog] = useState<WorkoutLog | null>(null);
  const [editExercises, setEditExercises] = useState<LoggedExercise[]>([]);

  const unitLabel = weightUnit === 'lbs' ? 'lbs' : 'kg';

  const loadMonthData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const startDate = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-01`;
      const endDay = daysInMonth(calYear, calMonth);
      const endDate = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
      const { data } = await supabase
        .from('workout_logs')
        .select('completed_at')
        .eq('user_id', user.id)
        .gte('completed_at', startDate)
        .lte('completed_at', endDate + 'T23:59:59');
      if (data) {
        setLogDates(new Set(data.map((l: any) => l.completed_at?.split('T')[0]).filter(Boolean)));
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [calMonth, calYear]);

  useFocusEffect(useCallback(() => { loadMonthData(); }, [loadMonthData]));

  const loadDayLogs = async (dateStr: string) => {
    setSelectedDate(dateStr);
    setDayLogs([]); // clear stale data immediately to prevent flash
    setDayLogsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('workout_logs')
        .select('id, day_name, exercises, duration_minutes, completed_at')
        .eq('user_id', user.id)
        .gte('completed_at', dateStr + 'T00:00:00')
        .lte('completed_at', dateStr + 'T23:59:59')
        .order('completed_at', { ascending: true });
      setDayLogs((data as WorkoutLog[]) ?? []);
    } catch {} finally {
      setDayLogsLoading(false);
    }
  };

  const startEditLog = (log: WorkoutLog) => {
    setEditingLog(log);
    setEditExercises(JSON.parse(JSON.stringify(log.exercises)));
  };

  const saveEditLog = async () => {
    if (!editingLog) return;
    try {
      await supabase.from('workout_logs').update({ exercises: editExercises }).eq('id', editingLog.id);
      setEditingLog(null);
      if (selectedDate) loadDayLogs(selectedDate);
    } catch {}
  };

  const updateEditSet = (exIdx: number, setIdx: number, field: 'weight' | 'reps', value: string) => {
    setEditExercises(prev => {
      const updated = [...prev];
      const sets = [...updated[exIdx].sets];
      if (field === 'weight') {
        sets[setIdx] = { ...sets[setIdx], weight: value === '' ? null : parseFloat(value) };
      } else {
        sets[setIdx] = { ...sets[setIdx], reps: parseInt(value) || 0 };
      }
      updated[exIdx] = { ...updated[exIdx], sets };
      return updated;
    });
  };

  // Calendar
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const totalDays = daysInMonth(calYear, calMonth);
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = new Date(calYear, calMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: 16 }}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </Pressable>
        <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text }}>Workout History</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Month navigation */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16 }}>
          <Pressable onPress={() => {
            setLogDates(new Set()); setSelectedDate(null); setDayLogs([]);
            if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
            else setCalMonth(m => m - 1);
          }}>
            <Ionicons name="chevron-back" size={22} color={theme.chrome} />
          </Pressable>
          <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text }}>{monthLabel}</Text>
          <Pressable onPress={() => {
            setLogDates(new Set()); setSelectedDate(null); setDayLogs([]);
            if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
            else setCalMonth(m => m + 1);
          }}>
            <Ionicons name="chevron-forward" size={22} color={theme.chrome} />
          </Pressable>
        </View>

        {/* Day headers */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 24, marginBottom: 8 }}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary }}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={{ paddingHorizontal: 24 }}>
          {Array.from({ length: cells.length / 7 }, (_, row) => (
            <View key={row} style={{ flexDirection: 'row', marginBottom: 4 }}>
              {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
                if (day == null) return <View key={col} style={{ flex: 1, height: 44 }} />;
                const dayStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const hasLog = logDates.has(dayStr);
                const isSelected = dayStr === selectedDate;
                return (
                  <Pressable
                    key={col}
                    onPress={() => {
                      // Premium gate: 3 month limit for free users
                      if (!isPro) {
                        const logDate = new Date(dayStr);
                        const threeMonthsAgo = new Date();
                        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
                        if (logDate < threeMonthsAgo) {
                          setShowProGate(true);
                          return;
                        }
                      }
                      loadDayLogs(dayStr);
                    }}
                    style={{ flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <View style={{
                      width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: isSelected ? theme.text : 'transparent',
                    }}>
                      <Text style={{
                        fontSize: 14,
                        fontWeight: isSelected ? '700' : '400',
                        color: isSelected ? theme.background : theme.text,
                      }}>{day}</Text>
                    </View>
                    {hasLog && (
                      <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#22C55E', position: 'absolute', bottom: 2 }} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* Day's workout details */}
        {selectedDate && (
          <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginBottom: 12 }}>
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
            {dayLogsLoading ? (
              <ActivityIndicator color={theme.chrome} />
            ) : dayLogs.length === 0 ? (
              <Text style={{ color: theme.textSecondary }}>No workouts on this day.</Text>
            ) : (
              dayLogs.map((log) => (
                <View key={log.id} style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.border }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>{log.day_name}</Text>
                    <Pressable onPress={() => startEditLog(log)} style={{ padding: 4 }}>
                      <Ionicons name="pencil-outline" size={18} color={theme.chrome} />
                    </Pressable>
                  </View>
                  <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 12 }}>
                    {log.duration_minutes} min · {log.exercises.reduce((s, ex) => s + ex.sets.filter(se => se.completed).length, 0)} sets
                  </Text>
                  {log.exercises.map((ex, i) => (
                    <View key={i} style={{ marginBottom: 10 }}>
                      <Pressable onPress={() => router.push({ pathname: '/exercise-detail', params: { exerciseName: ex.name } })}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: theme.chrome, marginBottom: 4 }}>{ex.name}</Text>
                      </Pressable>
                      {ex.sets.map((set, j) => (
                        <Text key={j} style={{ fontSize: 12, color: theme.textSecondary, marginLeft: 12, marginBottom: 2 }}>
                          Set {j + 1}: {set.weight != null ? `${set.weight} ${unitLabel} × ` : ''}{set.reps} reps {set.completed ? '✓' : ''}
                        </Text>
                      ))}
                    </View>
                  ))}
                  <Pressable
                    onPress={() => {
                      const histPlanDay = plan?.weeklyPlan.find(d => d.dayName.toLowerCase() === log.day_name.toLowerCase());
                      router.push({
                        pathname: '/workout/session-view',
                        params: {
                          exercises: JSON.stringify(log.exercises),
                          dayName: log.day_name,
                          focus: log.day_name || histPlanDay?.focus || '',
                          durationMinutes: String(log.duration_minutes),
                          completedAt: log.completed_at,
                          logId: log.id,
                        },
                      });
                    }}
                    style={{ backgroundColor: theme.text, paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 12 }}
                  >
                    <Text style={{ color: theme.background, fontWeight: '700', fontSize: 14 }}>View Session →</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Edit modal */}
      <Modal visible={!!editingLog} transparent animationType="slide" onRequestClose={() => setEditingLog(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setEditingLog(null)} />
        <View style={{ backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 48, maxHeight: '80%' }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: 'center', marginBottom: 16 }} />
          <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text, marginBottom: 16 }}>Edit Workout</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {editExercises.map((ex, exIdx) => (
              <View key={exIdx} style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text, marginBottom: 8 }}>{ex.name}</Text>
                {ex.sets.map((set, setIdx) => (
                  <View key={setIdx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, marginLeft: 8 }}>
                    <Text style={{ fontSize: 12, color: theme.textSecondary, width: 40 }}>Set {setIdx + 1}</Text>
                    <TextInput
                      style={{ flex: 1, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, color: theme.text }}
                      keyboardType="decimal-pad"
                      placeholder="Weight"
                      placeholderTextColor={theme.textSecondary}
                      value={set.weight != null ? String(set.weight) : ''}
                      onChangeText={(v) => updateEditSet(exIdx, setIdx, 'weight', v)}
                    />
                    <TextInput
                      style={{ flex: 1, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, color: theme.text }}
                      keyboardType="decimal-pad"
                      placeholder="Reps"
                      placeholderTextColor={theme.textSecondary}
                      value={set.reps > 0 ? String(set.reps) : ''}
                      onChangeText={(v) => updateEditSet(exIdx, setIdx, 'reps', v)}
                    />
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <Pressable
              onPress={saveEditLog}
              style={{ flex: 1, backgroundColor: theme.text, paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
            >
              <Text style={{ color: theme.background, fontWeight: '700', fontSize: 15 }}>Save</Text>
            </Pressable>
            <Pressable
              onPress={() => setEditingLog(null)}
              style={{ flex: 1, backgroundColor: theme.chromeLight, paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
            >
              <Text style={{ color: theme.textSecondary, fontWeight: '600', fontSize: 15 }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ProGateSheet visible={showProGate} onClose={() => setShowProGate(false)} feature="history" />
    </SafeAreaView>
  );
}
