import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePlan } from '@/lib/plan-context';
import { ExerciseCard } from '@/components/ExerciseCard';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getDateString() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export default function TodayScreen() {
  const router = useRouter();
  const { plan, loading } = usePlan();

  const today = DAY_NAMES[new Date().getDay()];
  const todayWorkout = plan?.weeklyPlan.find(
    (d) => d.dayName.toLowerCase() === today.toLowerCase()
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#18181B" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-6 pt-10 pb-2">
          <Text className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">
            {getDateString()}
          </Text>
          <Text className="text-4xl font-bold text-zinc-900 tracking-tight">
            Today's{'\n'}workout
          </Text>
        </View>

        {/* Content */}
        <View className="px-6 pt-6">
          {!plan ? (
            <View className="mt-10 items-center">
              <Text className="text-zinc-400 text-base text-center mb-8 leading-relaxed">
                You don't have a plan yet.{'\n'}Let's build one for you.
              </Text>
              <Pressable
                onPress={() => router.push('/quiz/1')}
                className="bg-zinc-900 px-8 py-4 rounded-2xl"
              >
                <Text className="text-white font-semibold text-base">Build my plan</Text>
              </Pressable>
            </View>

          ) : !todayWorkout ? (
            <View className="mt-10 items-center">
              <View className="bg-zinc-50 rounded-3xl p-8 items-center w-full">
                <Text className="text-5xl mb-4">🛋️</Text>
                <Text className="text-xl font-bold text-zinc-900 mb-2">Rest day</Text>
                <Text className="text-zinc-400 text-center leading-relaxed">
                  Enjoy your rest.{'\n'}Recovery is part of the process.
                </Text>
              </View>
            </View>

          ) : (
            <View>
              {/* Focus card */}
              <View className="bg-zinc-900 rounded-3xl px-6 py-6 mb-8">
                <Text className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-1">
                  Focus
                </Text>
                <Text className="text-xl font-bold text-white leading-snug">
                  {todayWorkout.focus}
                </Text>
                <Text className="text-sm text-white/40 mt-2">
                  {todayWorkout.exercises.length} exercises
                </Text>
              </View>

              {/* Exercise list */}
              <View>
                {todayWorkout.exercises.map((exercise, i) => (
                  <ExerciseCard
                    key={i}
                    exercise={exercise}
                    index={i}
                    isActive={false}
                    onPress={() => {}}
                  />
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      {todayWorkout && (
        <View className="px-6 pb-6 pt-3 bg-white">
          <Pressable
            onPress={() => {
              const dayIndex = plan!.weeklyPlan.indexOf(todayWorkout);
              router.push(`/workout/${dayIndex}`);
            }}
            className="bg-zinc-900 py-4 rounded-2xl items-center"
          >
            <Text className="text-white font-semibold text-base tracking-wide">
              Start workout →
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
