import { useCallback, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
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
import * as ImagePicker from 'expo-image-picker';

import { useSettings } from '@/lib/settings-context';
import { useUserStore } from '@/lib/user-store';
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
  const { avatarColor } = useUserStore();
  const magazineRef = useRef<View>(null);
  const stampRef = useRef<View>(null);
  const params = useLocalSearchParams<{
    exercises: string;
    dayName: string;
    focus: string;
    durationMinutes: string;
  }>();

  const [activeIndex, setActiveIndex] = useState(0);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const compositeRef = useRef<View>(null);

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
    accentColor: avatarColor,
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

  const handleSaveToCameraRoll = useCallback(async () => {
    const currentRef = photoUri ? compositeRef : (activeIndex === 0 ? magazineRef : stampRef);
    if (!currentRef.current) return;
    setSaving(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to save.');
        setSaving(false);
        return;
      }
      const uri = await captureRef(currentRef.current, { format: 'png', quality: 1 });
      await MediaLibrary.createAssetAsync(uri);
      Alert.alert('Saved!', 'Workout card saved to your camera roll.');
    } catch {
      Alert.alert('Error', 'Could not save the image.');
    } finally {
      setSaving(false);
    }
  }, [activeIndex, photoUri]);

  const handlePickPhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to select a background image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  }, []);

  const handleTakePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.9,
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  }, []);

  const handleShareComposite = useCallback(async () => {
    const currentRef = photoUri ? compositeRef : (activeIndex === 0 ? magazineRef : stampRef);
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
  }, [activeIndex, photoUri, params.focus, totalSets, displayVolume, unitLabel, durationMinutes]);

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

      {/* Photo overlay composite — rendered off-screen for capture */}
      {photoUri && (
        <View
          ref={compositeRef}
          collapsable={false}
          style={{
            position: 'absolute',
            left: -9999,
            width: SCREEN_WIDTH,
            aspectRatio: 3 / 4,
          }}
        >
          <Image
            source={{ uri: photoUri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
          {/* Dark overlay for readability */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)' }} />
          {/* Card overlay at bottom */}
          <View style={{ position: 'absolute', bottom: 20, left: 20, right: 20 }}>
            {activeIndex === 0 ? (
              <MagazineCard data={cardData} />
            ) : (
              <StampCard data={cardData} />
            )}
          </View>
          {/* Powered by Forme watermark */}
          <View style={{ position: 'absolute', top: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.5 }}>Powered by Forme</Text>
          </View>
        </View>
      )}

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

      {/* Photo overlay toggle */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12 }}>
        <Pressable
          onPress={handleTakePhoto}
          style={{
            flex: 1,
            backgroundColor: '#1A1A1A',
            borderRadius: 12,
            paddingVertical: 12,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 6,
            borderWidth: 1,
            borderColor: '#2A2A2A',
          }}
        >
          <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#FFFFFF' }}>Camera</Text>
        </Pressable>
        <Pressable
          onPress={handlePickPhoto}
          style={{
            flex: 1,
            backgroundColor: '#1A1A1A',
            borderRadius: 12,
            paddingVertical: 12,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 6,
            borderWidth: 1,
            borderColor: '#2A2A2A',
          }}
        >
          <Ionicons name="image-outline" size={18} color="#FFFFFF" />
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#FFFFFF' }}>
            {photoUri ? 'Change Photo' : 'Add Photo'}
          </Text>
        </Pressable>
      </View>

      {/* Photo indicator */}
      {photoUri && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' }} />
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Photo background active</Text>
          <Pressable onPress={() => setPhotoUri(null)} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.4)" />
          </Pressable>
        </View>
      )}

      {/* Footer buttons */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 8, gap: 8 }}>
        <Pressable
          onPress={photoUri ? handleShareComposite : handleShare}
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
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>Share</Text>
        </Pressable>
        <Pressable
          onPress={handleSaveToCameraRoll}
          disabled={saving}
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
            opacity: saving ? 0.5 : 1,
          }}
        >
          <Ionicons name="download-outline" size={20} color="#FFFFFF" />
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>
            {saving ? 'Saving...' : 'Save to Camera Roll'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
