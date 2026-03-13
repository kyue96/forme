import { Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { usePlan } from '@/lib/plan-context';

export default function ProfileScreen() {
  const router = useRouter();
  const { setPlan } = usePlan();

  const handleSignOut = async () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          setPlan(null);
        },
      },
    ]);
  };

  const handleResetPlan = () => {
    Alert.alert('Reset plan', 'This will rebuild your workout plan from scratch.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          setPlan(null);
          router.push('/quiz/1');
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 pt-8">
        <Text className="text-3xl font-bold text-zinc-900 mb-1">Profile</Text>
        <Text className="text-base text-zinc-500 mb-10">Manage your account.</Text>

        <View className="gap-3">
          <Pressable
            onPress={handleResetPlan}
            className="bg-zinc-50 border border-zinc-200 py-4 px-5 rounded-2xl flex-row items-center justify-between"
          >
            <Text className="text-base font-medium text-zinc-900">Rebuild my plan</Text>
            <Text className="text-zinc-400">→</Text>
          </Pressable>

          <Pressable
            onPress={handleSignOut}
            className="bg-zinc-50 border border-zinc-200 py-4 px-5 rounded-2xl flex-row items-center justify-between"
          >
            <Text className="text-base font-medium text-red-500">Sign out</Text>
            <Text className="text-zinc-400">→</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
