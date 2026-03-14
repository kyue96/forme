import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';

import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';
import { AppHeader } from '@/components/AppHeader';
import { LoggedExercise } from '@/lib/types';

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
  const { weightUnit, theme } = useSettings();
  const params = useLocalSearchParams<{
    exercises: string;
    dayName: string;
    focus: string;
    durationMinutes: string;
  }>();

  const notificationSent = useRef(false);
  const cardRef = useRef<View>(null);

  const exercises: LoggedExercise[] = params.exercises ? JSON.parse(params.exercises) : [];
  const durationMinutes = parseInt(params.durationMinutes ?? '0', 10);
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const totalExercises = exercises.length;
  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.filter((s) => s.completed).length, 0);
  const totalVolume = exercises.reduce(
    (sum, ex) =>
      sum + ex.sets.filter((s) => s.completed && s.weight != null)
        .reduce((s, set) => s + (set.weight ?? 0) * set.reps, 0),
    0
  );

  // Volume in user's preferred unit
  const displayVolume = weightUnit === 'lbs' ? Math.round(totalVolume * 2.205) : totalVolume;

  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [macrosSaved, setMacrosSaved] = useState(false);
  const [savingMacros, setSavingMacros] = useState(false);
  const [darkCard, setDarkCard] = useState(true);

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
        content: { title: 'Great workout!', body: 'Time to refuel — log your meal.' },
        trigger: null,
      });
    } catch {}
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
    } catch {} finally {
      setSavingMacros(false);
    }
  };

  const handleShare = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to save your workout card.');
        return;
      }

      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      const asset = await MediaLibrary.createAssetAsync(uri);
      await Share.share({
        url: asset.uri,
        message: `Just finished ${params.focus} — ${totalExercises} exercises, ${totalSets} sets, ${formatVolume(displayVolume)} ${weightUnit} volume in ${durationMinutes} min`,
      });
    } catch {
      Alert.alert('Error', 'Could not save or share the workout card.');
    }
  };

  const formatVolume = (v: number): string => {
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return String(Math.round(v));
  };

  const isDark = darkCard;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <AppHeader />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 }}>
          <Text allowFontScaling style={{ fontSize: 28, fontWeight: '800', color: theme.text, marginBottom: 4 }}>Workout complete</Text>
          <Text allowFontScaling style={{ fontSize: 14, color: theme.textSecondary }}>{params.focus} · {params.dayName}</Text>
        </View>

        {/* Summary stats */}
        <View className="px-6 mb-6">
          <View className="flex-row gap-3">
            <View className="flex-1 bg-zinc-50 rounded-2xl p-4 items-center">
              <Text allowFontScaling className="text-2xl font-bold text-zinc-900">{totalExercises}</Text>
              <Text allowFontScaling className="text-xs text-zinc-400 mt-1">Exercises</Text>
            </View>
            <View className="flex-1 bg-zinc-50 rounded-2xl p-4 items-center">
              <Text allowFontScaling className="text-2xl font-bold text-zinc-900">{totalSets}</Text>
              <Text allowFontScaling className="text-xs text-zinc-400 mt-1">Sets</Text>
            </View>
          </View>
          <View className="flex-row gap-3 mt-3">
            <View className="flex-1 bg-zinc-50 rounded-2xl p-4 items-center">
              <Text allowFontScaling className="text-2xl font-bold text-zinc-900">{formatVolume(displayVolume)}</Text>
              <Text allowFontScaling className="text-xs text-zinc-400 mt-1">Volume ({weightUnit})</Text>
            </View>
            <View className="flex-1 bg-zinc-50 rounded-2xl p-4 items-center">
              <Text allowFontScaling className="text-2xl font-bold text-zinc-900">{durationMinutes}</Text>
              <Text allowFontScaling className="text-xs text-zinc-400 mt-1">Minutes</Text>
            </View>
          </View>
        </View>

        {/* Shareable workout card */}
        <View className="px-6 mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text allowFontScaling className="text-sm font-semibold text-zinc-500">Workout card</Text>
            <Pressable onPress={handleShare}>
              <Ionicons name="share-outline" size={22} color="#F59E0B" />
            </Pressable>
          </View>

          <Pressable onPress={() => setDarkCard(!darkCard)}>
            <View
              ref={cardRef}
              collapsable={false}
              className={`rounded-3xl p-6 ${isDark ? 'bg-zinc-900' : 'bg-white border border-zinc-200'}`}
            >
              <Text allowFontScaling className={`text-xl font-bold mb-1 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                {params.focus}
              </Text>
              <Text allowFontScaling className={`text-sm mb-1 ${isDark ? 'text-white/50' : 'text-zinc-500'}`}>
                {params.dayName} · {dateStr}
              </Text>

              <View className="flex-row justify-between mt-5">
                {[
                  { val: totalExercises, label: 'exercises' },
                  { val: totalSets, label: 'sets' },
                  { val: formatVolume(displayVolume), label: `${weightUnit} vol` },
                  { val: durationMinutes, label: 'min' },
                ].map(({ val, label }) => (
                  <View key={label}>
                    <Text allowFontScaling className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>{val}</Text>
                    <Text allowFontScaling className={`text-xs ${isDark ? 'text-white/40' : 'text-zinc-400'}`}>{label}</Text>
                  </View>
                ))}
              </View>

              <Text allowFontScaling className={`text-xs font-bold uppercase tracking-widest mt-5 ${isDark ? 'text-white/20' : 'text-zinc-300'}`}>
                Forme
              </Text>
            </View>
          </Pressable>
          <Text allowFontScaling className="text-xs text-zinc-400 text-center mt-2">Tap card to switch template</Text>
        </View>

        {/* Macro logging */}
        <View className="px-6 mb-6">
          <Text allowFontScaling className="text-lg font-bold text-zinc-900 mb-1">Log your meal</Text>
          <Text allowFontScaling className="text-sm text-zinc-500 mb-4">Quick post-workout nutrition tracking.</Text>

          {macrosSaved ? (
            <View className="bg-amber-50 rounded-2xl p-4 items-center">
              <Ionicons name="checkmark-circle" size={24} color="#F59E0B" />
              <Text allowFontScaling className="text-amber-700 font-semibold mt-1">Macros saved!</Text>
            </View>
          ) : (
            <>
              <View className="flex-row gap-3 mb-4">
                {[
                  { label: 'Calories', val: calories, set: setCalories },
                  { label: 'Protein (g)', val: protein, set: setProtein },
                  { label: 'Carbs (g)', val: carbs, set: setCarbs },
                ].map(({ label, val, set }) => (
                  <View key={label} className="flex-1">
                    <Text allowFontScaling className="text-xs text-zinc-400 mb-1.5">{label}</Text>
                    <TextInput
                      className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-base text-zinc-900"
                      keyboardType="number-pad"
                      placeholder="—"
                      placeholderTextColor="#A1A1AA"
                      value={val}
                      onChangeText={set}
                    />
                  </View>
                ))}
              </View>
              <Pressable onPress={saveMacros} disabled={savingMacros} className="bg-zinc-100 py-3 rounded-xl items-center">
                <Text allowFontScaling className="text-zinc-900 font-semibold text-sm">
                  {savingMacros ? 'Saving…' : 'Save macros'}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>

      {/* Done button */}
      <View className="px-6 pb-6 pt-3 bg-white border-t border-zinc-100">
        <Pressable onPress={() => router.replace('/(tabs)')} className="bg-amber-500 py-4 rounded-2xl items-center">
          <Text allowFontScaling className="text-white font-semibold text-base">Done</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
