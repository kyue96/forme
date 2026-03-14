import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { useQuiz } from '@/lib/quiz-store';
import { usePlan } from '@/lib/plan-context';
import { WorkoutDay } from '@/lib/types';
import { useSettings } from '@/lib/settings-context';

const LOADING_MESSAGES = [
  'Analysing your goals…',
  'Picking the right exercises…',
  'Balancing your schedule…',
  'Finalising your plan…',
];

export default function PlanResultScreen() {
  const router = useRouter();
  const { answers, resetQuiz } = useQuiz();
  const { setPlan } = usePlan();
  const { theme } = useSettings();

  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [weeklyPlan, setWeeklyPlan] = useState<WorkoutDay[] | null>(null);
  const msgIndex = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      msgIndex.current = (msgIndex.current + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[msgIndex.current]);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    generatePlan();
  }, []);

  const generatePlan = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-plan', {
        body: { mode: 'plan', answers },
      });

      if (error) {
        // Try to extract the actual error message from the function response
        let detail = error.message;
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) detail = body.error;
        } catch {}
        throw new Error(detail);
      }

      const plan = data?.weeklyPlan as WorkoutDay[];
      setWeeklyPlan(plan);

      // Save to Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: saved } = await supabase
          .from('workout_plans')
          .insert({ user_id: user.id, plan: { weeklyPlan: plan } })
          .select()
          .single();

        if (saved) {
          setPlan({
            id: saved.id,
            userId: saved.user_id,
            weeklyPlan: plan,
            createdAt: saved.created_at,
          });
        }

        // Also save quiz data to profile for TDEE calculation
        if (answers.height && answers.weight) {
          await supabase.from('profiles').upsert({
            id: user.id,
            height: answers.height,
            weight: answers.weight,
            goal: answers.goal,
            days_per_week: answers.daysPerWeek,
            gender: answers.gender,
          });
        }
      }

      resetQuiz();
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      Alert.alert(
        'Something went wrong',
        msg,
        [{ text: 'Retry', onPress: generatePlan }]
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <ActivityIndicator size="large" color={theme.text} />
          <Text style={{ fontSize: 16, color: theme.textSecondary, marginTop: 24, textAlign: 'center' }}>{loadingMsg}</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 }}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: theme.text, marginBottom: 4 }}>Your plan is ready</Text>
            <Text style={{ fontSize: 16, color: theme.textSecondary, marginBottom: 32 }}>
              Here's your personalised weekly programme.
            </Text>

            {weeklyPlan?.map((day, i) => (
              <View key={i} style={{ marginBottom: 20, backgroundColor: theme.surface, borderRadius: 16, padding: 16 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: theme.chrome, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>
                  {day.dayName}
                </Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text, marginBottom: 12 }}>{day.focus}</Text>
                {day.exercises.map((ex, j) => (
                  <View key={j} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.chrome, marginTop: 8, marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>{ex.name}</Text>
                      <Text style={{ fontSize: 12, color: theme.textSecondary }}>
                        {ex.sets} sets · {ex.reps} reps · {ex.rest} rest
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>

          <View style={{ paddingHorizontal: 24, paddingBottom: 24, paddingTop: 8 }}>
            <Pressable
              onPress={() => router.replace('/(tabs)')}
              style={{ backgroundColor: theme.text, paddingVertical: 16, borderRadius: 16, alignItems: 'center' }}
            >
              <Text style={{ color: theme.background, fontSize: 16, fontWeight: '600' }}>
                Let's go →
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
