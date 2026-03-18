import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';

import { useSettings } from '@/lib/settings-context';
import { LoggedExercise } from '@/lib/types';
import { EXERCISE_DATABASE } from '@/lib/exercise-data';
import { formatNumber } from '@/lib/utils';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getMusclesWorked(exercises: LoggedExercise[]): string[] {
  const muscles = new Set<string>();
  for (const ex of exercises) {
    const match = EXERCISE_DATABASE.find(
      (e) => e.name.toLowerCase() === ex.name.toLowerCase()
    );
    if (match) muscles.add(match.category);
    else {
      const lower = ex.name.toLowerCase();
      if (lower.includes('bench') || lower.includes('chest') || lower.includes('push') || lower.includes('fly')) muscles.add('Chest');
      else if (lower.includes('row') || lower.includes('pull') || lower.includes('lat') || lower.includes('deadlift')) muscles.add('Back');
      else if (lower.includes('squat') || lower.includes('leg') || lower.includes('lunge') || lower.includes('calf') || lower.includes('hip')) muscles.add('Legs');
      else if (lower.includes('shoulder') || lower.includes('press') || lower.includes('raise') || lower.includes('delt')) muscles.add('Shoulders');
      else if (lower.includes('curl') || lower.includes('tricep') || lower.includes('bicep')) muscles.add('Arms');
      else if (lower.includes('plank') || lower.includes('crunch') || lower.includes('ab') || lower.includes('core')) muscles.add('Core');
    }
  }
  return Array.from(muscles);
}

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

  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.filter((s) => s.completed).length, 0);
  const totalReps = exercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.completed).reduce((r, set) => r + set.reps, 0),
    0
  );
  const totalVolume = exercises.reduce(
    (sum, ex) =>
      sum + ex.sets.filter((s) => s.completed && s.weight != null)
        .reduce((s, set) => s + (set.weight ?? 0) * set.reps, 0),
    0
  );
  const displayVolume = weightUnit === 'lbs' ? Math.round(totalVolume * 2.205) : totalVolume;
  const unitLabel = weightUnit === 'lbs' ? 'lbs' : 'kg';
  const musclesWorked = getMusclesWorked(exercises);

  const [showCard, setShowCard] = useState(false);

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
        content: { title: 'Great workout!', body: 'Time to refuel \u2014 log your meal.' },
        trigger: null,
      });
    } catch {}
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
        message: `Just finished ${params.focus} \u2014 ${totalSets} sets, ${totalReps} reps, ${formatNumber(displayVolume)} ${weightUnit} moved in ${durationMinutes} min`,
      });
    } catch {
      Alert.alert('Error', 'Could not save or share the workout card.');
    }
  };

  const formatDuration = (mins: number): string => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      {/* Header with back button */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: theme.background,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ padding: 4, marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={{ fontSize: 17, fontWeight: '800', letterSpacing: 3, color: theme.text, textTransform: 'uppercase' }}>
          FORME
        </Text>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: theme.text, marginBottom: 4 }}>Workout complete</Text>
          <Text style={{ fontSize: 14, color: theme.textSecondary }}>{params.focus} · {params.dayName}</Text>
        </View>

        {/* Summary metrics */}
        <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 26, fontWeight: '700', color: theme.text }}>{totalSets}</Text>
              <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}>Sets</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 26, fontWeight: '700', color: theme.text }}>{totalReps}</Text>
              <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}>Reps</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 26, fontWeight: '700', color: theme.text }}>{formatNumber(displayVolume)}</Text>
              <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}>{unitLabel} Moved</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
            <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 26, fontWeight: '700', color: theme.text }}>{formatDuration(durationMinutes)}</Text>
              <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}>Time</Text>
            </View>
          </View>
          {musclesWorked.length > 0 && (
            <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginTop: 12 }}>
              <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 8 }}>Muscles Worked</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {musclesWorked.map((m) => (
                  <View key={m} style={{ backgroundColor: theme.background, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: theme.border }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>{m}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Share Workout button */}
        <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
          {!showCard ? (
            <Pressable
              onPress={() => setShowCard(true)}
              style={{
                backgroundColor: theme.surface,
                borderRadius: 16,
                paddingVertical: 16,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: theme.border,
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Ionicons name="share-outline" size={20} color={theme.text} />
              <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }}>Share Workout</Text>
            </Pressable>
          ) : (
            <View>
              {/* Capturable card - simple dark style */}
              <View ref={cardRef} collapsable={false}>
                <View style={{ backgroundColor: '#000000', borderRadius: 20, padding: 24 }}>
                  {/* Share icon inside card but excluded from capture via positioning outside ref would need a different approach. Instead, we keep it outside the cardRef. */}

                  {/* Header */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF', letterSpacing: 3 }}>
                      FORME
                    </Text>
                    <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5 }}>
                      {dateStr}
                    </Text>
                  </View>

                  {/* Focus + day */}
                  <Text style={{ fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 2 }}>
                    {(params.focus ?? '').length > 22 ? (params.focus ?? '').slice(0, 22) + '\u2026' : params.focus}
                  </Text>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>{params.dayName}</Text>

                  {/* Divider */}
                  <View style={{ height: 2, backgroundColor: '#FFFFFF', marginBottom: 16 }} />

                  {/* Metrics - single clean row */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    {[
                      { val: String(totalSets), label: 'SETS' },
                      { val: String(totalReps), label: 'REPS' },
                      { val: formatNumber(displayVolume), label: unitLabel.toUpperCase() },
                      { val: formatDuration(durationMinutes), label: 'TIME' },
                    ].map(({ val, label }) => (
                      <View key={label} style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={{ fontSize: 22, fontWeight: '800', color: '#FFFFFF', fontVariant: ['tabular-nums'] }}>{val}</Text>
                        <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5, marginTop: 2 }}>{label}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Body part tags */}
                  {musclesWorked.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 16 }}>
                      {musclesWorked.map((m) => (
                        <View key={m} style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                          <Text style={{ fontSize: 10, color: '#FFFFFF', fontWeight: '600' }}>{m}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>

              {/* Action buttons - outside cardRef so excluded from exported image */}
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 12 }}>
                <Pressable
                  onPress={handleShare}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: theme.surface,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: theme.border,
                  }}
                >
                  <Ionicons name="share-outline" size={18} color={theme.text} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>Save & Share</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    const cardDataJson = JSON.stringify({
                      focus: params.focus ?? '',
                      dayName: params.dayName ?? '',
                      sets: totalSets,
                      reps: totalReps,
                      volume: displayVolume,
                      unitLabel,
                      durationMinutes,
                      muscles: musclesWorked,
                    });
                    router.push({ pathname: '/create-post', params: { cardData: cardDataJson } });
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: theme.text,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 12,
                  }}
                >
                  <Ionicons name="people" size={18} color={theme.background} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: theme.background }}>Post to Forme</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Done button */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 32, paddingTop: 12, backgroundColor: theme.background }}>
        <Pressable
          onPress={() => router.replace('/(tabs)')}
          style={{ backgroundColor: theme.text, paddingVertical: 16, borderRadius: 16, alignItems: 'center' }}
        >
          <Text style={{ color: theme.background, fontWeight: '600', fontSize: 16 }}>Done</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
