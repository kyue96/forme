import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { signInWithApple, signInWithGoogle } from '@/lib/auth-providers';

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      Alert.alert('Sign in failed', error.message);
    }
  };

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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        className="flex-1"
      >
        <View className="flex-1 px-6 pt-6 pb-8 justify-between">
          <View>
            <Pressable onPress={() => router.back()} className="mb-10">
              <Text className="text-zinc-500 text-base">← Back</Text>
            </Pressable>

            <Text className="text-3xl font-bold text-zinc-900 mb-2">
              Welcome back
            </Text>
            <Text className="text-zinc-500 mb-8">Good to see you again.</Text>

            {/* Social sign-in buttons */}
            <Pressable
              onPress={handleAppleSignIn}
              disabled={loading}
              className="bg-zinc-900 py-4 rounded-2xl items-center flex-row justify-center gap-2 mb-3"
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
              className="bg-white border border-zinc-200 py-4 rounded-2xl items-center flex-row justify-center gap-2 mb-4"
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
            <View className="flex-row items-center gap-3 my-4">
              <View className="flex-1 h-px bg-zinc-200" />
              <Text className="text-zinc-400 text-sm">or</Text>
              <View className="flex-1 h-px bg-zinc-200" />
            </View>

            {/* Email sign-in form */}
            <Text className="text-sm font-medium text-zinc-700 mb-1.5">Email</Text>
            <TextInput
              className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3.5 text-base text-zinc-900 mb-4"
              placeholder="you@example.com"
              placeholderTextColor="#A1A1AA"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              editable={!loading}
            />

            <Text className="text-sm font-medium text-zinc-700 mb-1.5">Password</Text>
            <TextInput
              className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3.5 text-base text-zinc-900"
              placeholder="Your password"
              placeholderTextColor="#A1A1AA"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              editable={!loading}
            />
          </View>

          <Pressable
            onPress={handleSignIn}
            disabled={loading}
            className="bg-zinc-900 py-4 rounded-2xl items-center"
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text className="text-white text-base font-semibold">Sign in</Text>
            }
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
