import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { usePlan } from '@/lib/plan-context';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';
import { AppHeader } from '@/components/AppHeader';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NAMES_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getWeekDates(): Date[] {
  const now = new Date();
  const dow = now.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function dateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

const MOTIVATIONAL = [
  'Your muscles grow during rest, not during the workout.',
  'Sleep is the most underrated performance enhancer.',
  'Hydrate well — your body needs it for recovery.',
  'Stretching today prevents injury tomorrow.',
  'Recovery is not optional. It is part of the program.',
];

const RECOVERY_TIPS = [
  'Foam roll your tight spots for 5-10 minutes.',
  'Take a 15-minute walk to promote blood flow.',
  'Try contrast showers: alternate hot and cold water.',
  'Focus on getting 7-9 hours of quality sleep tonight.',
];

export default function HomeScreen() {
  const router = useRouter();
  const { plan, loading } = usePlan();
  const { theme } = useSettings();

  const [completedDays, setCompletedDays] = useState<Set<string>>(new Set());
  const [todayCompleted, setTodayCompleted] = useState(false);
  const [todayCalories, setTodayCalories] = useState<number | null>(null);
  const [todayMeals, setTodayMeals] = useState<any[]>([]);
  const [nutritionExpanded, setNutritionExpanded] = useState(false);

  const [selectedDay, setSelectedDay] = useState<{ date: Date; dayIdx: number } | null>(null);
  const [dayLog, setDayLog] = useState<any>(null);
  const [dayLogLoading, setDayLogLoading] = useState(false);

  const weekDates = getWeekDates();
  const now = new Date();
  const todayStr = dateKey(now);

  const jsDayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const todayWorkout = plan?.weeklyPlan.find((d) => d.dayName.toLowerCase() === jsDayName);
  const todayIdx = (now.getDay() + 6) % 7;

  const nextWorkout = plan?.weeklyPlan.find((d) => {
    const idx = DAY_NAMES_FULL.findIndex((n) => n.toLowerCase() === d.dayName.toLowerCase());
    return idx > todayIdx;
  });

  const planDayNames = new Set(plan?.weeklyPlan.map((d) => d.dayName.toLowerCase()) ?? []);

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const monKey = dateKey(weekDates[0]);
      const sunKey = dateKey(weekDates[6]);

      const { data: logs } = await supabase
        .from('workout_logs')
        .select('completed_at')
        .eq('user_id', user.id)
        .gte('completed_at', monKey)
        .lte('completed_at', sunKey + 'T23:59:59');

      if (logs) {
        const days = new Set(logs.map((l) => l.completed_at?.split('T')[0]).filter(Boolean) as string[]);
        setCompletedDays(days);
        setTodayCompleted(days.has(todayStr));
      }

      const { data: meals } = await supabase
        .from('meals')
        .select('calories')
        .eq('user_id', user.id)
        .eq('date', todayStr);

      if (meals && meals.length > 0) {
        setTodayCalories(meals.reduce((s, m) => s + (m.calories ?? 0), 0));
      } else {
        setTodayCalories(null);
      }

      const { data: mealsData } = await supabase
        .from('meals')
        .select('id, name, calories, protein, carbs')
        .eq('user_id', user.id)
        .eq('date', todayStr);
      setTodayMeals(mealsData ?? []);
    } catch {}
  }, [todayStr]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleDayPress = async (date: Date, i: number) => {
    setSelectedDay({ date, dayIdx: i });
    setDayLog(null);
    const dk = dateKey(date);
    const dayName = DAY_NAMES_FULL[i];
    const plannedDay = plan?.weeklyPlan.find(d => d.dayName.toLowerCase() === dayName.toLowerCase());
    setDayLogLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: logs } = await supabase
        .from('workout_logs')
        .select('day_name, exercises, duration_minutes, completed_at')
        .eq('user_id', user.id)
        .gte('completed_at', dk + 'T00:00:00')
        .lte('completed_at', dk + 'T23:59:59')
        .limit(1);
      setDayLog({ log: logs?.[0] ?? null, planned: plannedDay });
    } catch {} finally {
      setDayLogLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.chrome} />
      </SafeAreaView>
    );
  }

  const quote = MOTIVATIONAL[now.getDate() % MOTIVATIONAL.length];
  const tip = RECOVERY_TIPS[now.getDate() % RECOVERY_TIPS.length];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <AppHeader />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Date heading */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          <Text allowFontScaling style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>
            {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
          <Text allowFontScaling style={{ fontSize: 28, fontWeight: '800', color: theme.text, letterSpacing: -0.5 }}>
            Today
          </Text>
        </View>

        {/* Calendar strip */}
        {plan && (
          <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {weekDates.map((date, i) => {
                const dk = dateKey(date);
                const isToday = dk === todayStr;
                const done = completedDays.has(dk);
                const isWorkDay = planDayNames.has(DAY_NAMES_FULL[i].toLowerCase());
                const isPast = date < now && !isToday;

                let circleBg = theme.surface;
                let borderStyle: object = { borderWidth: 1, borderColor: theme.border };
                if (done) { circleBg = '#22C55E'; borderStyle = {}; }
                else if (isToday) { circleBg = theme.text; borderStyle = {}; }
                else if (!isWorkDay) { circleBg = theme.surface; borderStyle = {}; }
                else if (isPast) { circleBg = theme.surface; }

                return (
                  <Pressable key={i} style={{ alignItems: 'center' }} onPress={() => handleDayPress(date, i)}>
                    <Text allowFontScaling style={{
                      fontSize: 11,
                      marginBottom: 6,
                      fontWeight: isToday ? '700' : '400',
                      color: isToday ? theme.text : theme.textSecondary,
                    }}>
                      {DAY_LABELS[i]}
                    </Text>
                    <View style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: circleBg,
                      ...borderStyle,
                    }}>
                      {done ? (
                        <Ionicons name="checkmark" size={16} color={theme.background} />
                      ) : (
                        <Text allowFontScaling style={{
                          fontSize: 13,
                          fontWeight: '600',
                          color: isToday ? theme.background : !isWorkDay ? theme.border : theme.textSecondary,
                        }}>
                          {date.getDate()}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        <View style={{ paddingHorizontal: 24 }}>
          {!plan ? (
            <View style={{ marginTop: 40, alignItems: 'center' }}>
              <Text allowFontScaling style={{ color: theme.textSecondary, fontSize: 15, textAlign: 'center', marginBottom: 32, lineHeight: 22 }}>
                You don't have a plan yet.{'\n'}Let's build one for you.
              </Text>
              <Pressable
                onPress={() => router.push('/quiz/1')}
                style={{ backgroundColor: theme.text, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 16 }}
              >
                <Text allowFontScaling style={{ color: theme.background, fontWeight: '700', fontSize: 15 }}>Build my plan</Text>
              </Pressable>
            </View>

          ) : todayCompleted ? (
            <View>
              <View style={{ backgroundColor: theme.surface, borderRadius: 24, padding: 24, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: theme.border }}>
                <Ionicons name="checkmark-circle" size={48} color="#22C55E" />
                <Text allowFontScaling style={{ fontSize: 20, fontWeight: '800', color: theme.text, marginTop: 12, marginBottom: 4 }}>
                  Workout complete
                </Text>
                <Text allowFontScaling style={{ fontSize: 13, color: theme.textSecondary, textAlign: 'center' }}>
                  Great work today. Recovery starts now.
                </Text>
                {todayWorkout && (
                  <Pressable
                    onPress={() => {
                      const idx = plan.weeklyPlan.indexOf(todayWorkout);
                      if (idx >= 0) router.push(`/workout/${idx}`);
                    }}
                    style={{ marginTop: 16, backgroundColor: theme.text, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
                  >
                    <Text allowFontScaling style={{ color: theme.background, fontWeight: '600', fontSize: 13 }}>View workout</Text>
                  </Pressable>
                )}
              </View>
            </View>

          ) : !todayWorkout ? (
            <View>
              <View style={{ backgroundColor: theme.surface, borderRadius: 24, padding: 24, marginBottom: 16, borderWidth: 1, borderColor: theme.border }}>
                <Text allowFontScaling style={{ fontSize: 18, fontWeight: '800', color: theme.text, marginBottom: 8 }}>Rest day</Text>
                <Text allowFontScaling style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 20, marginBottom: 16 }}>{quote}</Text>
                <View style={{ backgroundColor: theme.background, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: theme.border }}>
                  <Text allowFontScaling style={{ fontSize: 10, fontWeight: '700', color: theme.chrome, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                    Recovery tip
                  </Text>
                  <Text allowFontScaling style={{ fontSize: 13, color: theme.text }}>{tip}</Text>
                </View>
              </View>
              {nextWorkout && (
                <View style={{ backgroundColor: theme.text, borderRadius: 16, padding: 20 }}>
                  <Text allowFontScaling style={{ fontSize: 10, color: theme.background + '66', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>
                    Up next
                  </Text>
                  <Text allowFontScaling style={{ fontSize: 15, fontWeight: '800', color: theme.background }}>
                    {nextWorkout.focus}
                  </Text>
                  <Text allowFontScaling style={{ fontSize: 12, color: theme.background + '80', marginTop: 4 }}>
                    {nextWorkout.dayName} · {nextWorkout.exercises.length} exercises
                  </Text>
                </View>
              )}
            </View>

          ) : (
            <View>
              <View style={{ backgroundColor: theme.text, borderRadius: 24, paddingHorizontal: 24, paddingVertical: 24, marginBottom: 12 }}>
                <Text allowFontScaling style={{ fontSize: 10, fontWeight: '600', color: theme.background + '66', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>
                  Focus
                </Text>
                <Text allowFontScaling style={{ fontSize: 22, fontWeight: '800', color: theme.background, lineHeight: 28 }}>
                  {todayWorkout.focus}
                </Text>
                <Text allowFontScaling style={{ fontSize: 13, color: theme.background + '66', marginTop: 6 }}>
                  {todayWorkout.exercises.length} exercises
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  const idx = plan.weeklyPlan.indexOf(todayWorkout);
                  router.push(`/workout/${idx}`);
                }}
                style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginBottom: 24 }}
              >
                <Text allowFontScaling style={{ color: theme.text, fontWeight: '700', fontSize: 15, letterSpacing: 0.5 }}>
                  Start workout →
                </Text>
              </Pressable>
            </View>
          )}

          {/* Nutrition card */}
          {plan && (
            <Pressable
              onPress={() => setNutritionExpanded(!nutritionExpanded)}
              style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginTop: 8, borderWidth: 1, borderColor: theme.border }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text allowFontScaling style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>Today's nutrition</Text>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Pressable onPress={(e) => { e.stopPropagation(); router.push('/(tabs)/meals'); }}>
                    <Text allowFontScaling style={{ fontSize: 13, fontWeight: '600', color: theme.chrome }}>+ Add</Text>
                  </Pressable>
                  <Ionicons name={nutritionExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={theme.chrome} />
                </View>
              </View>
              <Text allowFontScaling style={{ fontSize: 28, fontWeight: '800', color: theme.text }}>
                {todayCalories != null ? `${todayCalories} cal` : '—'}
              </Text>
              <Text allowFontScaling style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>logged today</Text>

              {nutritionExpanded && todayMeals.length > 0 && (
                <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 12 }}>
                  {todayMeals.map((meal, i) => (
                    <View key={meal.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text allowFontScaling style={{ fontSize: 13, color: theme.text }}>{meal.name || `Meal ${i + 1}`}</Text>
                      <Text allowFontScaling style={{ fontSize: 12, color: theme.textSecondary }}>{meal.calories ?? 0} cal</Text>
                    </View>
                  ))}
                </View>
              )}
              {nutritionExpanded && todayMeals.length === 0 && (
                <Text allowFontScaling style={{ fontSize: 12, color: theme.textSecondary, marginTop: 8 }}>No meals logged yet.</Text>
              )}
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* Day detail modal */}
      <Modal visible={!!selectedDay} transparent animationType="slide" onRequestClose={() => setSelectedDay(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setSelectedDay(null)} />
        <View style={{ backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48, maxHeight: '70%' }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: 'center', marginBottom: 16 }} />
          {dayLogLoading ? (
            <ActivityIndicator color={theme.chrome} />
          ) : selectedDay && (
            <>
              <Text style={{ fontSize: 11, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>
                {selectedDay.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </Text>
              {dayLog?.log ? (
                // Completed workout
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' }} />
                    <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>{dayLog.log.day_name}</Text>
                  </View>
                  <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 12 }}>
                    {dayLog.log.exercises?.length ?? 0} exercises · {dayLog.log.duration_minutes} min
                  </Text>
                  <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
                    {(dayLog.log.exercises ?? []).map((ex: any, i: number) => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#22C55E', marginRight: 8 }} />
                        <Text style={{ fontSize: 13, color: theme.text, flex: 1 }}>{ex.name}</Text>
                        <Text style={{ fontSize: 11, color: theme.textSecondary }}>{ex.sets?.filter((s: any) => s.completed).length ?? 0} sets</Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              ) : dayLog?.planned ? (
                // Planned workout
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text, marginBottom: 4 }}>{dayLog.planned.focus}</Text>
                  <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 12 }}>{dayLog.planned.exercises.length} exercises planned</Text>
                  {dateKey(selectedDay.date) === todayStr && (
                    <Pressable
                      onPress={() => {
                        setSelectedDay(null);
                        const idx = plan?.weeklyPlan.indexOf(dayLog.planned);
                        if (idx != null && idx >= 0) router.push(`/workout/${idx}`);
                      }}
                      style={{ backgroundColor: theme.text, paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 8 }}
                    >
                      <Text style={{ color: theme.background, fontWeight: '700' }}>Start workout →</Text>
                    </Pressable>
                  )}
                </View>
              ) : (
                <Text style={{ color: theme.textSecondary, marginTop: 8 }}>No workout logged or planned for this day.</Text>
              )}
            </>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
