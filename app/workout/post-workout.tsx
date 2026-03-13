import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';

import { supabase } from '@/lib/supabase';
import { LoggedExercise } from '@/lib/types';

// Configure notifications to show even when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function PostWorkoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    exercises: string;
    dayName: string;
    focus: string;
    durationMinutes: string;
  }>();

  const notificationSent = useRef(false);

  const exercises: LoggedExercise[] = params.exercises
    ? JSON.parse(params.exercises)
    : [];
  const durationMinutes = parseInt(params.durationMinutes ?? '0', 10);

  // Calculate summary stats
  const totalExercises = exercises.length;
  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.filter((s) => s.completed).length, 0);
  const totalVolume = exercises.reduce(
    (sum, ex) =>
      sum +
      ex.sets
        .filter((s) => s.completed && s.weight != null)
        .reduce((s, set) => s + (set.weight ?? 0) * set.reps, 0),
    0
  );

  // Macro inputs
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [macrosSaved, setMacrosSaved] = useState(false);
  const [savingMacros, setSavingMacros] = useState(false);

  // Fire notification once
  useEffect(() => {
    if (!notificationSent.current) {
      notificationSent.current = true;
      sendNotification();
    }
  }, []);

  const sendNotification = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Great workout!',
          body: 'Time to refuel — log your meal.',
        },
        trigger: null, // fire immediately
      });
    } catch {
      // Notification failed — not critical
    }
  };

  const saveMacros = async () => {
    const cal = parseInt(calories) || null;
    const prot = parseInt(protein) || null;
    const carb = parseInt(carbs) || null;

    if (!cal && !prot && !carb) return;

    setSavingMacros(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('meals').insert({
        user_id: user.id,
        date: new Date().toISOString().split('T')[0],
        calories: cal,
        protein: prot,
        carbs: carb,
      });

      setMacrosSaved(true);
    } catch {
      // Fail silently
    } finally {
      setSavingMacros(false);
    }
  };

  const formatVolume = (v: number): string => {
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return String(Math.round(v));
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-6 pt-10 pb-6">
          <Text className="text-3xl font-bold text-zinc-900 mb-1">Workout complete</Text>
          <Text className="text-base text-zinc-500">
            {params.focus} · {params.dayName}
          </Text>
        </View>

        {/* Summary stats */}
        <View className="px-6 mb-6">
          <View className="flex-row gap-3">
            <View className="flex-1 bg-zinc-50 rounded-2xl p-4 items-center">
              <Text className="text-2xl font-bold text-zinc-900">{totalExercises}</Text>
              <Text className="text-xs text-zinc-400 mt-1">Exercises</Text>
            </View>
            <View className="flex-1 bg-zinc-50 rounded-2xl p-4 items-center">
              <Text className="text-2xl font-bold text-zinc-900">{totalSets}</Text>
              <Text className="text-xs text-zinc-400 mt-1">Sets</Text>
            </View>
          </View>
          <View className="flex-row gap-3 mt-3">
            <View className="flex-1 bg-zinc-50 rounded-2xl p-4 items-center">
              <Text className="text-2xl font-bold text-zinc-900">{formatVolume(totalVolume)}</Text>
              <Text className="text-xs text-zinc-400 mt-1">Volume (kg)</Text>
            </View>
            <View className="flex-1 bg-zinc-50 rounded-2xl p-4 items-center">
              <Text className="text-2xl font-bold text-zinc-900">{durationMinutes}</Text>
              <Text className="text-xs text-zinc-400 mt-1">Minutes</Text>
            </View>
          </View>
        </View>

        {/* Shareable workout card */}
        <View className="px-6 mb-8">
          <View className="bg-zinc-900 rounded-3xl p-6">
            <Text className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">
              Forme
            </Text>
            <Text className="text-xl font-bold text-white mb-1">{params.focus}</Text>
            <Text className="text-sm text-white/50 mb-6">{params.dayName}</Text>

            <View className="flex-row justify-between">
              <View>
                <Text className="text-2xl font-bold text-white">{totalExercises}</Text>
                <Text className="text-xs text-white/40">exercises</Text>
              </View>
              <View>
                <Text className="text-2xl font-bold text-white">{totalSets}</Text>
                <Text className="text-xs text-white/40">sets</Text>
              </View>
              <View>
                <Text className="text-2xl font-bold text-white">{formatVolume(totalVolume)}</Text>
                <Text className="text-xs text-white/40">kg volume</Text>
              </View>
              <View>
                <Text className="text-2xl font-bold text-white">{durationMinutes}</Text>
                <Text className="text-xs text-white/40">min</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Macro logging */}
        <View className="px-6 mb-6">
          <Text className="text-lg font-bold text-zinc-900 mb-1">Log your meal</Text>
          <Text className="text-sm text-zinc-500 mb-4">
            Quick post-workout nutrition tracking.
          </Text>

          {macrosSaved ? (
            <View className="bg-green-50 rounded-2xl p-4 items-center">
              <Text className="text-green-700 font-semibold">Macros saved!</Text>
            </View>
          ) : (
            <>
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-xs text-zinc-400 mb-1.5">Calories</Text>
                  <TextInput
                    className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-base text-zinc-900"
                    keyboardType="number-pad"
                    placeholder="—"
                    placeholderTextColor="#A1A1AA"
                    value={calories}
                    onChangeText={setCalories}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-zinc-400 mb-1.5">Protein (g)</Text>
                  <TextInput
                    className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-base text-zinc-900"
                    keyboardType="number-pad"
                    placeholder="—"
                    placeholderTextColor="#A1A1AA"
                    value={protein}
                    onChangeText={setProtein}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-zinc-400 mb-1.5">Carbs (g)</Text>
                  <TextInput
                    className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-base text-zinc-900"
                    keyboardType="number-pad"
                    placeholder="—"
                    placeholderTextColor="#A1A1AA"
                    value={carbs}
                    onChangeText={setCarbs}
                  />
                </View>
              </View>

              <Pressable
                onPress={saveMacros}
                disabled={savingMacros}
                className="bg-zinc-100 py-3 rounded-xl items-center"
              >
                <Text className="text-zinc-900 font-semibold text-sm">
                  {savingMacros ? 'Saving…' : 'Save macros'}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>

      {/* Done button */}
      <View className="px-6 pb-6 pt-3 bg-white border-t border-zinc-100">
        <Pressable
          onPress={() => router.replace('/(tabs)')}
          className="bg-zinc-900 py-4 rounded-2xl items-center"
        >
          <Text className="text-white font-semibold text-base">Done</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
