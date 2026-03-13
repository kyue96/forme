import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePlan } from '@/lib/plan-context';

export default function PlanScreen() {
  const router = useRouter();
  const { plan, loading } = usePlan();

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#18181B" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1" contentContainerClassName="px-6 pt-8 pb-6">
        <Text className="text-3xl font-bold text-zinc-900 mb-1">My Plan</Text>
        <Text className="text-base text-zinc-500 mb-8">Your weekly programme.</Text>

        {!plan ? (
          <View className="mt-8 items-center">
            <Text className="text-zinc-500 text-base text-center mb-6">
              No plan yet. Take the quiz to get started.
            </Text>
            <Pressable
              onPress={() => router.push('/quiz/1')}
              className="bg-zinc-900 px-6 py-3.5 rounded-2xl"
            >
              <Text className="text-white font-semibold">Take the quiz</Text>
            </Pressable>
          </View>
        ) : (
          plan.weeklyPlan.map((day, i) => (
            <View key={i} className="mb-5">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
                  {day.dayName}
                </Text>
                <Pressable onPress={() => router.push(`/workout/${i}`)}>
                  <Text className="text-xs font-semibold text-zinc-900">Log →</Text>
                </Pressable>
              </View>
              <View className="bg-zinc-50 rounded-2xl p-4">
                <Text className="text-base font-bold text-zinc-900 mb-3">{day.focus}</Text>
                {day.exercises.map((ex, j) => (
                  <View key={j} className="flex-row items-start mb-2.5 last:mb-0">
                    <View className="w-1.5 h-1.5 rounded-full bg-zinc-300 mt-2 mr-2.5" />
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-zinc-800">{ex.name}</Text>
                      <Text className="text-xs text-zinc-500">
                        {ex.sets} sets · {ex.reps} reps · {ex.rest} rest
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
