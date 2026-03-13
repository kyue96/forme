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
    <SafeAreaView className="flex-1 bg-white">
      {loading ? (
        <View className="flex-1 items-center justify-center px-8">
          <ActivityIndicator size="large" color="#18181B" />
          <Text className="text-base text-zinc-500 mt-6 text-center">{loadingMsg}</Text>
        </View>
      ) : (
        <View className="flex-1">
          <ScrollView className="flex-1" contentContainerClassName="px-6 pt-8 pb-6">
            <Text className="text-3xl font-bold text-zinc-900 mb-1">Your plan is ready</Text>
            <Text className="text-base text-zinc-500 mb-8">
              Here's your personalised weekly programme.
            </Text>

            {weeklyPlan?.map((day, i) => (
              <View key={i} className="mb-5 bg-zinc-50 rounded-2xl p-4">
                <Text className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">
                  {day.dayName}
                </Text>
                <Text className="text-base font-bold text-zinc-900 mb-3">{day.focus}</Text>
                {day.exercises.map((ex, j) => (
                  <View key={j} className="flex-row items-start mb-2 last:mb-0">
                    <View className="w-1.5 h-1.5 rounded-full bg-zinc-400 mt-2 mr-2.5" />
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-zinc-800">{ex.name}</Text>
                      <Text className="text-xs text-zinc-500">
                        {ex.sets} sets · {ex.reps} reps · {ex.rest} rest
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>

          <View className="px-6 pb-6 pt-2">
            <Pressable
              onPress={() => router.replace('/(tabs)')}
              className="bg-zinc-900 py-4 rounded-2xl items-center"
            >
              <Text className="text-white text-base font-semibold">
                Let's go →
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
