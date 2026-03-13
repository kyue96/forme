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
import { supabase } from '@/lib/supabase';

export default function SignUpScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      Alert.alert('Sign up failed', error.message);
    } else {
      // Auth listener in root layout will handle redirect to quiz
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 px-6 pt-6 pb-8 justify-between">
          <View>
            {/* Back */}
            <Pressable onPress={() => router.back()} className="mb-10">
              <Text className="text-zinc-500 text-base">← Back</Text>
            </Pressable>

            <Text className="text-3xl font-bold text-zinc-900 mb-2">
              Create account
            </Text>
            <Text className="text-zinc-500 mb-8">
              We'll build your personalised plan next.
            </Text>

            <Text className="text-sm font-medium text-zinc-700 mb-1.5">Email</Text>
            <TextInput
              className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3.5 text-base text-zinc-900 mb-4"
              placeholder="you@example.com"
              placeholderTextColor="#A1A1AA"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />

            <Text className="text-sm font-medium text-zinc-700 mb-1.5">Password</Text>
            <TextInput
              className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3.5 text-base text-zinc-900"
              placeholder="Min. 6 characters"
              placeholderTextColor="#A1A1AA"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <Pressable
            onPress={handleSignUp}
            disabled={loading}
            className="bg-zinc-900 py-4 rounded-2xl items-center"
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text className="text-white text-base font-semibold">Create account</Text>
            }
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
