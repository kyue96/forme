import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { QuizTile } from '@/components/QuizTile';
import { usePlan } from '@/lib/plan-context';
import { supabase } from '@/lib/supabase';
import { WorkoutDay } from '@/lib/types';

type Location = 'Home' | 'Gym';
type Duration = 30 | 45 | 60 | 90;

interface MuscleOption {
  label: string;
  recommended: boolean;
  lastWorked: string | null;
}

export default function PreWorkoutScreen() {
  const router = useRouter();
  const { plan, setPlan } = usePlan();

  const [step, setStep] = useState(1);
  const [location, setLocation] = useState<Location | null>(null);
  const [duration, setDuration] = useState<Duration | null>(null);
  const [muscleOptions, setMuscleOptions] = useState<MuscleOption[]>([]);
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loadingMuscles, setLoadingMuscles] = useState(false);

  useEffect(() => {
    if (step === 3) loadMuscleOptions();
  }, [step]);

  const loadMuscleOptions = async () => {
    setLoadingMuscles(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !plan) return;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: logs } = await supabase
        .from('workout_logs')
        .select('day_name, completed_at')
        .eq('user_id', user.id)
        .gte('completed_at', sevenDaysAgo.toISOString())
        .order('completed_at', { ascending: false });

      // Map focus area → last worked date
      const lastWorkedMap: Record<string, string> = {};
      if (logs) {
        for (const log of logs) {
          const day = plan.weeklyPlan.find(
            (d) => d.dayName.toLowerCase() === log.day_name.toLowerCase()
          );
          if (day && !lastWorkedMap[day.focus]) {
            lastWorkedMap[day.focus] = log.completed_at;
          }
        }
      }

      const now = Date.now();
      const fortyEightHours = 48 * 60 * 60 * 1000;

      const options: MuscleOption[] = plan.weeklyPlan.map((day) => {
        const lastDate = lastWorkedMap[day.focus] ?? null;
        const timeSince = lastDate ? now - new Date(lastDate).getTime() : Infinity;
        return {
          label: day.focus,
          recommended: timeSince > fortyEightHours,
          lastWorked: lastDate,
        };
      });

      // Deduplicate and sort recommended first
      const unique = options
        .filter((o, i, arr) => arr.findIndex((x) => x.label === o.label) === i)
        .sort((a, b) => (a.recommended === b.recommended ? 0 : a.recommended ? -1 : 1));

      setMuscleOptions(unique);
    } catch {
      if (plan) {
        setMuscleOptions(
          plan.weeklyPlan
            .map((d) => d.focus)
            .filter((f, i, arr) => arr.indexOf(f) === i)
            .map((f) => ({ label: f, recommended: true, lastWorked: null }))
        );
      }
    } finally {
      setLoadingMuscles(false);
    }
  };

  const handleGenerate = async () => {
    if (!location || !duration || !selectedMuscle || !plan) return;
    setGenerating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: recentLogs } = await supabase
        .from('workout_logs')
        .select('day_name, completed_at')
        .eq('user_id', user.id)
        .gte('completed_at', sevenDaysAgo.toISOString());

      const lastWorked = (recentLogs ?? []).map((l) => ({
        muscleGroup: l.day_name,
        date: l.completed_at,
      }));

      const { data, error } = await supabase.functions.invoke('generate-plan', {
        body: {
          mode: 'session',
          session: {
            location,
            availableMinutes: duration,
            muscleGroup: selectedMuscle,
            lastWorked,
          },
        },
      });

      if (error) throw error;

      // Append generated session to plan and navigate to it
      const session = data as WorkoutDay;
      const newIndex = plan.weeklyPlan.length;

      setPlan({
        ...plan,
        weeklyPlan: [...plan.weeklyPlan, session],
      });

      router.replace(`/workout/${newIndex}`);
    } catch {
      setGenerating(false);
    }
  };

  const canProceed =
    (step === 1 && !!location) ||
    (step === 2 && !!duration) ||
    (step === 3 && !!selectedMuscle);

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else handleGenerate();
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 pt-4">
        {/* Header */}
        <View className="flex-row items-center mb-6">
          <Pressable
            onPress={() => (step > 1 ? setStep(step - 1) : router.back())}
            className="w-9 h-9 items-center justify-center"
          >
            <Text className="text-zinc-900 text-xl">←</Text>
          </Pressable>
          <View className="flex-1 mx-4">
            <View className="flex-row gap-2 justify-center">
              {[1, 2, 3].map((s) => (
                <View
                  key={s}
                  className={`h-1.5 rounded-full ${
                    s <= step ? 'bg-zinc-900 w-8' : 'bg-zinc-200 w-4'
                  }`}
                />
              ))}
            </View>
          </View>
          <View className="w-9" />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
          {generating ? (
            <View className="items-center pt-20">
              <ActivityIndicator size="large" color="#18181B" />
              <Text className="text-base text-zinc-500 mt-6 text-center">
                Building your session…
              </Text>
            </View>
          ) : step === 1 ? (
            <View>
              <Text className="text-2xl font-bold text-zinc-900 mb-1">
                Where are you training?
              </Text>
              <Text className="text-base text-zinc-500 mb-8">
                We'll tailor exercises to your setup.
              </Text>
              <View className="flex-row flex-wrap mx-[-4px]">
                <QuizTile label="Home" selected={location === 'Home'} onPress={() => setLocation('Home')} />
                <QuizTile label="Gym" selected={location === 'Gym'} onPress={() => setLocation('Gym')} />
              </View>
            </View>
          ) : step === 2 ? (
            <View>
              <Text className="text-2xl font-bold text-zinc-900 mb-1">
                How much time do you have?
              </Text>
              <Text className="text-base text-zinc-500 mb-8">
                We'll fit the perfect session.
              </Text>
              <View className="flex-row flex-wrap mx-[-4px]">
                {([30, 45, 60, 90] as Duration[]).map((d) => (
                  <QuizTile
                    key={d}
                    label={`${d} min`}
                    selected={duration === d}
                    onPress={() => setDuration(d)}
                  />
                ))}
              </View>
            </View>
          ) : (
            <View>
              <Text className="text-2xl font-bold text-zinc-900 mb-1">
                What are we training?
              </Text>
              <Text className="text-base text-zinc-500 mb-8">
                Based on your split and recovery.
              </Text>
              {loadingMuscles ? (
                <ActivityIndicator color="#18181B" className="mt-8" />
              ) : (
                <View>
                  {muscleOptions.map((opt) => (
                    <Pressable
                      key={opt.label}
                      onPress={() => setSelectedMuscle(opt.label)}
                      className={`mb-3 p-4 rounded-2xl border-2 ${
                        selectedMuscle === opt.label
                          ? 'bg-zinc-900 border-zinc-900'
                          : 'bg-white border-zinc-200'
                      }`}
                    >
                      <View className="flex-row items-center justify-between">
                        <Text
                          className={`text-base font-semibold ${
                            selectedMuscle === opt.label ? 'text-white' : 'text-zinc-900'
                          }`}
                        >
                          {opt.label}
                        </Text>
                        {opt.recommended && (
                          <View className="bg-green-100 px-2 py-0.5 rounded-full">
                            <Text className="text-xs font-medium text-green-700">Ready</Text>
                          </View>
                        )}
                        {!opt.recommended && (
                          <View className="bg-amber-100 px-2 py-0.5 rounded-full">
                            <Text className="text-xs font-medium text-amber-700">Recent</Text>
                          </View>
                        )}
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {!generating && (
          <View className="pb-4 pt-2">
            <Pressable
              onPress={handleNext}
              disabled={!canProceed}
              className={`py-4 rounded-2xl items-center ${
                canProceed ? 'bg-zinc-900' : 'bg-zinc-200'
              }`}
            >
              <Text className={`text-base font-semibold ${canProceed ? 'text-white' : 'text-zinc-400'}`}>
                {step === 3 ? 'Generate session' : 'Continue'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
