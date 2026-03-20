import { useCallback, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Alert,
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  Share,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';

import { useSettings } from '@/lib/settings-context';
import { LoggedExercise } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import {
  computeBestSet,
  computeDensity,
  computeAvgIntensity,
  computeTopE1RMs,
  getVolumeComparison,
} from '@/lib/workout-metrics';
import { EXERCISE_DATABASE } from '@/lib/exercise-data';
import { ShareCardData, CARD_VARIANTS, CardVariant } from '@/components/share-cards/types';
import { MagazineCard } from '@/components/share-cards/MagazineCard';
import { StampCard } from '@/components/share-cards/StampCard';

const SCREEN_WIDTH = Dimensions.get('window').width;

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

export default function CardPickerScreen() {
  const router = useRouter();
  const { weightUnit } = useSettings();
  const magazineRef = useRef<View>(null);
  const stampRef = useRef<View>(null);
  const params = useLocalSearchParams<{
    exercises: string;
    dayName: string;
    focus: string;
    durationMinutes: string;
  }>();

  const [activeIndex, setActiveIndex] = useState(0);

  // Parse data
  const exercises: LoggedExercise[] = params.exercises ? JSON.parse(params.exercises) : [];
  const durationMinutes = parseInt(params.durationMinutes ?? '0', 10);
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.filter((s) => s.completed).length, 0);
  const totalReps = exercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.completed).reduce((r, set) => r + set.reps, 0),
    0
  );
  const totalVolumeRaw = exercises.reduce(
    (sum, ex) =>
      sum + ex.sets.filter((s) => s.completed && s.weight != null)
        .reduce((s, set) => s + (set.weight ?? 0) * set.reps, 0),
    0
  );
  const displayVolume = Math.round(totalVolumeRaw);
  const unitLabel = weightUnit === 'lbs' ? 'lbs' : 'kg';

  const density = computeDensity(exercises, durationMinutes);
  const displayDensity = Math.round(density);
  const avgIntensity = computeAvgIntensity(exercises);
  const topE1RMs = computeTopE1RMs(exercises, 1);
  const bestSet = computeBestSet(exercises);
  const displayBestSet = bestSet;
  // For volume comparison strings, convert to lbs if user is in kg mode
  const volumeLbs = weightUnit === 'kg' ? Math.round(totalVolumeRaw * 2.205) : displayVolume;
  const volumeComparison = getVolumeComparison(volumeLbs);

  const cardData: ShareCardData = {
    dayName: params.dayName ?? '',
    focus: params.focus ?? '',
    date: dateStr,
    totalVolume: displayVolume,
    unitLabel,
    bestSet: displayBestSet,
    durationMinutes,
    totalSets,
    totalReps,
    musclesWorked: getMusclesWorked(exercises),
    density: displayDensity,
    avgIntensity,
    topE1RM: topE1RMs.length > 0 ? topE1RMs[0].e1rm : null,
    volumeComparison,
  };

  const selectedVariant = CARD_VARIANTS[activeIndex].id;

  const handleShare = useCallback(async () => {
    const currentRef = activeIndex === 0 ? magazineRef : stampRef;
    if (!currentRef.current) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to share.');
        return;
      }
      const uri = await captureRef(currentRef.current, { format: 'png', quality: 1 });
      const asset = await MediaLibrary.createAssetAsync(uri);
      await Share.share({
        url: asset.uri,
        message: `Just finished ${params.focus} \u2014 ${totalSets} sets, ${formatNumber(displayVolume)} ${unitLabel} moved in ${durationMinutes} min`,
      });
    } catch {
      Alert.alert('Error', 'Could not save or share the workout card.');
    }
  }, [activeIndex, params.focus, totalSets, displayVolume, unitLabel, durationMinutes]);

  const onScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    setActiveIndex(index);
  }, []);

  const renderCard = useCallback(({ item }: { item: CardVariant }) => (
    <View style={{ width: SCREEN_WIDTH, alignItems: 'center', justifyContent: 'center' }}>
      {item.id === 'magazine' && <MagazineCard ref={magazineRef} data={cardData} />}
      {item.id === 'stamp' && <StampCard ref={stampRef} data={cardData} />}
    </View>
  ), [cardData]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      {/* Header — close button only */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 10 }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Swipeable card area */}
      <FlatList
        data={CARD_VARIANTS}
        renderItem={renderCard}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ alignItems: 'center' }}
      />

      {/* Spacer */}
      <View style={{ flex: 1 }} />

      {/* Dot indicators */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 16 }}>
        {CARD_VARIANTS.map((variant, i) => (
          <View
            key={variant.id}
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: i === activeIndex ? '#FFFFFF' : 'transparent',
              borderWidth: 1,
              borderColor: i === activeIndex ? '#FFFFFF' : 'rgba(255,255,255,0.35)',
            }}
          />
        ))}
      </View>

      {/* Save & Share footer */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <Pressable
          onPress={handleShare}
          style={{
            backgroundColor: '#1A1A1A',
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
            borderWidth: 1,
            borderColor: '#2A2A2A',
          }}
        >
          <Ionicons name="share-outline" size={20} color="#FFFFFF" />
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>Save & Share</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
