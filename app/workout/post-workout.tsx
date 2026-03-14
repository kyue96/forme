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
        <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 16, alignItems: 'center' }}>
              <Text allowFontScaling style={{ fontSize: 24, fontWeight: '700', color: theme.text }}>{totalExercises}</Text>
              <Text allowFontScaling style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4 }}>Exercises</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 16, alignItems: 'center' }}>
              <Text allowFontScaling style={{ fontSize: 24, fontWeight: '700', color: theme.text }}>{totalSets}</Text>
              <Text allowFontScaling style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4 }}>Sets</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
            <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 16, alignItems: 'center' }}>
              <Text allowFontScaling style={{ fontSize: 24, fontWeight: '700', color: theme.text }}>{formatVolume(displayVolume)}</Text>
              <Text allowFontScaling style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4 }}>Volume ({weightUnit})</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 16, alignItems: 'center' }}>
              <Text allowFontScaling style={{ fontSize: 24, fontWeight: '700', color: theme.text }}>{durationMinutes}</Text>
              <Text allowFontScaling style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4 }}>Minutes</Text>
            </View>
          </View>
        </View>

        {/* Shareable workout card - black bg, receipt style */}
        <View style={{ paddingHorizontal: 24, marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text allowFontScaling style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary }}>Workout card</Text>
            <Pressable onPress={handleShare}>
              <Ionicons name="share-outline" size={22} color={theme.text} />
            </Pressable>
          </View>

          <View
            ref={cardRef}
            collapsable={false}
            style={{ backgroundColor: '#000000', borderRadius: 20, padding: 24 }}
          >
            {/* Header row */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF', letterSpacing: 3, textTransform: 'uppercase' }}>
                FORME
              </Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5 }}>
                {dateStr}
              </Text>
            </View>

            {/* Focus + day */}
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginBottom: 2 }}>
              {(params.focus ?? '').length > 22 ? (params.focus ?? '').slice(0, 22) + '…' : params.focus}
            </Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>{params.dayName}</Text>

            {/* Divider */}
            <View style={{ height: 2, backgroundColor: '#FFFFFF', marginBottom: 20 }} />

            {/* Metrics grid */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {[
                { val: String(totalExercises), label: 'EXERCISES' },
                { val: String(totalSets), label: 'SETS' },
                { val: formatVolume(displayVolume), label: weightUnit.toUpperCase() + ' VOL' },
                { val: `${String(Math.floor(durationMinutes / 60)).padStart(2,'0')}:${String(durationMinutes % 60).padStart(2,'0')}`, label: 'DURATION' },
              ].map(({ val, label }) => (
                <View key={label} style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, fontWeight: '800', color: '#FFFFFF', fontVariant: ['tabular-nums'] }}>{val}</Text>
                  <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', letterSpacing: 1, marginTop: 2 }}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Macro logging */}
        <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
          <Text allowFontScaling style={{ fontSize: 18, fontWeight: '700', color: theme.text, marginBottom: 4 }}>Log your meal</Text>
          <Text allowFontScaling style={{ fontSize: 14, color: theme.textSecondary, marginBottom: 16 }}>Quick post-workout nutrition tracking.</Text>

          {macrosSaved ? (
            <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#22C55E' }}>
              <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
              <Text allowFontScaling style={{ color: '#22C55E', fontWeight: '600', marginTop: 4 }}>Macros saved!</Text>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'Calories', val: calories, set: setCalories },
                  { label: 'Protein (g)', val: protein, set: setProtein },
                  { label: 'Carbs (g)', val: carbs, set: setCarbs },
                ].map(({ label, val, set }) => (
                  <View key={label} style={{ flex: 1 }}>
                    <Text allowFontScaling style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 6 }}>{label}</Text>
                    <TextInput
                      style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: theme.text }}
                      keyboardType="number-pad"
                      placeholder="—"
                      placeholderTextColor={theme.textSecondary}
                      value={val}
                      onChangeText={set}
                    />
                  </View>
                ))}
              </View>
              <Pressable
                onPress={saveMacros}
                disabled={savingMacros}
                style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
              >
                <Text allowFontScaling style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>
                  {savingMacros ? 'Saving…' : 'Save macros'}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>

      {/* Done button */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 32, paddingTop: 12, backgroundColor: theme.background }}>
        <Pressable
          onPress={() => router.replace('/(tabs)')}
          style={{ backgroundColor: theme.text, paddingVertical: 16, borderRadius: 16, alignItems: 'center' }}
        >
          <Text allowFontScaling style={{ color: theme.background, fontWeight: '600', fontSize: 16 }}>Done</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
