import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  LayoutAnimation,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { usePlan } from '@/lib/plan-context';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';
import { AppHeader } from '@/components/AppHeader';
import { LoggedExercise } from '@/lib/types';

interface WorkoutLog {
  id: string;
  day_name: string;
  exercises: LoggedExercise[];
  duration_minutes: number;
  completed_at: string;
}

export default function WorkoutScreen() {
  const router = useRouter();
  const { plan, loading } = usePlan();
  const { theme, weightUnit } = useSettings();

  const [showHistory, setShowHistory] = useState(false);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<WorkoutLog | null>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  const loadHistory = useCallback(async () => {
    setLogsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('workout_logs')
        .select('id, day_name, exercises, duration_minutes, completed_at')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(30);
      setLogs((data as WorkoutLog[]) ?? []);
    } catch {} finally {
      setLogsLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadHistory(); }, [loadHistory]));

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <ActivityIndicator color={theme.chrome} />
      </SafeAreaView>
    );
  }

  const unitLabel = weightUnit === 'lbs' ? 'lbs' : 'kg';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <AppHeader />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <View>
            <Text allowFontScaling style={{ fontSize: 28, fontWeight: '800', color: theme.text, marginBottom: 2 }}>
              My Plan
            </Text>
            <Text allowFontScaling style={{ fontSize: 13, color: theme.textSecondary }}>
              Your weekly programme
            </Text>
          </View>
          <Pressable
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setShowHistory(!showHistory);
            }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: theme.surface,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <Ionicons
              name={showHistory ? 'barbell' : 'calendar-outline'}
              size={20}
              color={theme.chrome}
            />
          </Pressable>
        </View>

        {showHistory ? (
          /* Past workout history */
          <View>
            <Text allowFontScaling style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16 }}>
              Workout history
            </Text>
            {logsLoading ? (
              <ActivityIndicator color={theme.chrome} />
            ) : logs.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <Ionicons name="barbell-outline" size={32} color={theme.border} />
                <Text allowFontScaling style={{ color: theme.textSecondary, marginTop: 8 }}>
                  No workouts logged yet.
                </Text>
              </View>
            ) : (
              logs.map((log) => {
                const date = new Date(log.completed_at).toLocaleDateString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric',
                });
                const totalSets = log.exercises.reduce((s, ex) => s + ex.sets.filter((se) => se.completed).length, 0);
                return (
                  <Pressable
                    key={log.id}
                    onPress={() => setSelectedLog(log)}
                    style={{
                      backgroundColor: theme.surface,
                      borderRadius: 16,
                      padding: 16,
                      marginBottom: 10,
                      borderWidth: 1,
                      borderColor: theme.border,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <View>
                      <Text allowFontScaling style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>
                        {log.day_name}
                      </Text>
                      <Text allowFontScaling style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
                        {date} · {totalSets} sets · {log.duration_minutes} min
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.chrome} />
                  </Pressable>
                );
              })
            )}
          </View>
        ) : (
          /* Weekly plan — accordion */
          <View>
            {!plan ? (
              <View style={{ marginTop: 32, alignItems: 'center' }}>
                <Text allowFontScaling style={{ color: theme.textSecondary, fontSize: 15, textAlign: 'center', marginBottom: 24 }}>
                  No plan yet. Take the quiz to get started.
                </Text>
                <Pressable
                  onPress={() => router.push('/quiz/1')}
                  style={{ backgroundColor: theme.text, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 }}
                >
                  <Text allowFontScaling style={{ color: theme.background, fontWeight: '700' }}>Take the quiz</Text>
                </Pressable>
              </View>
            ) : (
              plan.weeklyPlan.map((day, i) => {
                const isOpen = expandedDay === i;
                return (
                  <View
                    key={i}
                    style={{
                      marginBottom: 10,
                      borderRadius: 16,
                      backgroundColor: theme.surface,
                      borderWidth: 1,
                      borderColor: theme.border,
                      overflow: 'hidden',
                    }}
                  >
                    {/* Collapsed header */}
                    <Pressable
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setExpandedDay(isOpen ? null : i);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text allowFontScaling style={{ fontSize: 11, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>
                          {day.dayName}
                        </Text>
                        <Text allowFontScaling style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>
                          {day.focus}
                          <Text style={{ fontSize: 13, fontWeight: '400', color: theme.textSecondary }}>
                            {' '}· {day.exercises.length} exercises
                          </Text>
                        </Text>
                      </View>
                      <Ionicons
                        name={isOpen ? 'contract-outline' : 'expand-outline'}
                        size={18}
                        color={theme.chrome}
                      />
                    </Pressable>

                    {/* Expanded exercises */}
                    {isOpen && (
                      <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                        <View style={{ height: 1, backgroundColor: theme.border, marginBottom: 12 }} />
                        {day.exercises.map((ex, j) => (
                          <View key={j} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.chrome, marginTop: 6, marginRight: 10 }} />
                            <View style={{ flex: 1 }}>
                              <Text allowFontScaling style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>
                                {ex.name}
                              </Text>
                              <Text allowFontScaling style={{ fontSize: 11, color: theme.textSecondary, marginTop: 1 }}>
                                {ex.sets} sets · {ex.reps} reps · {ex.rest} rest
                              </Text>
                            </View>
                          </View>
                        ))}
                        <Pressable
                          onPress={() => router.push(`/workout/${i}`)}
                          style={{
                            marginTop: 8,
                            backgroundColor: theme.text,
                            paddingVertical: 12,
                            borderRadius: 12,
                            alignItems: 'center',
                          }}
                        >
                          <Text allowFontScaling style={{ color: theme.background, fontWeight: '700', fontSize: 13 }}>
                            Start workout →
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* Log detail modal */}
      <Modal
        visible={!!selectedLog}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedLog(null)}
      >
        <Pressable
          onPress={() => setSelectedLog(null)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
        />
        <View style={{
          backgroundColor: theme.surface,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingHorizontal: 24,
          paddingTop: 20,
          paddingBottom: 48,
          maxHeight: '80%',
        }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.chrome, alignSelf: 'center', marginBottom: 16 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text allowFontScaling style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>
              {selectedLog?.day_name}
            </Text>
            <Pressable onPress={() => setSelectedLog(null)}>
              <Ionicons name="close" size={24} color={theme.chrome} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {selectedLog?.exercises.map((ex, i) => (
              <View key={i} style={{ marginBottom: 16 }}>
                <Text allowFontScaling style={{ fontSize: 14, fontWeight: '700', color: theme.text, marginBottom: 8 }}>
                  {ex.name}
                </Text>
                {ex.sets.map((set, j) => (
                  <View key={j} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, marginLeft: 8 }}>
                    <View style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 8,
                      backgroundColor: set.completed ? theme.chrome : theme.border,
                    }}>
                      {set.completed && <Ionicons name="checkmark" size={12} color={theme.background} />}
                    </View>
                    <Text allowFontScaling style={{ fontSize: 13, color: theme.text }}>
                      Set {j + 1}: {set.weight != null ? `${set.weight} ${unitLabel} × ` : ''}{set.reps} reps
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
