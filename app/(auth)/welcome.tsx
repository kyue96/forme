import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { signInWithApple, signInWithGoogle } from '@/lib/auth-providers';

export default function WelcomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleAppleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithApple();
    } catch (error) {
      Alert.alert(
        'Sign in failed',
        error instanceof Error ? error.message : 'An error occurred'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      Alert.alert(
        'Sign in failed',
        error instanceof Error ? error.message : 'An error occurred'
      );
    } finally {
      setLoading(false);
    }
  };

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
          {/* Social sign-in buttons */}
          <Pressable
            onPress={handleAppleSignIn}
            disabled={loading}
            className="bg-zinc-900 py-4 rounded-2xl items-center flex-row justify-center gap-2"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="logo-apple" size={20} color="#fff" />
                <Text className="text-white text-base font-semibold">
                  Continue with Apple
                </Text>
              </>
            )}
          </Pressable>

          <Pressable
            onPress={handleGoogleSignIn}
            disabled={loading}
            className="bg-white border border-zinc-200 py-4 rounded-2xl items-center flex-row justify-center gap-2"
          >
            {loading ? (
              <ActivityIndicator color="#27272a" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#27272a" />
                <Text className="text-zinc-900 text-base font-semibold">
                  Continue with Google
                </Text>
              </>
            )}
          </Pressable>

          {/* Divider */}
          <View className="flex-row items-center gap-3 my-2">
            <View className="flex-1 h-px bg-zinc-200" />
            <Text className="text-zinc-400 text-sm">or</Text>
            <View className="flex-1 h-px bg-zinc-200" />
          </View>

          {/* Email sign-in buttons */}
          <Pressable
            onPress={() => router.push('/(auth)/sign-up')}
            disabled={loading}
            className="bg-zinc-900 py-4 rounded-2xl items-center"
          >
            <Text className="text-white text-base font-semibold">
              Get started
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(auth)/sign-in')}
            disabled={loading}
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
