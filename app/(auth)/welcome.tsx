import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 justify-between pb-8 pt-16">
        {/* Brand mark */}
        <View className="flex-1 justify-center items-start">
          <Text className="text-5xl font-bold text-zinc-900 tracking-tight mb-3">
            Forme
          </Text>
          <Text className="text-xl text-zinc-500 leading-relaxed">
            The gym companion{'\n'}that gets you.
          </Text>
        </View>

        {/* Actions */}
        <View className="gap-3">
          <Pressable
            onPress={() => router.push('/(auth)/sign-up')}
            className="bg-zinc-900 py-4 rounded-2xl items-center"
          >
            <Text className="text-white text-base font-semibold">
              Get started
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(auth)/sign-in')}
            className="py-4 rounded-2xl items-center"
          >
            <Text className="text-zinc-500 text-base">
              Already have an account?{' '}
              <Text className="text-zinc-900 font-semibold">Sign in</Text>
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
