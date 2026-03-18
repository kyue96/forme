import { useCallback, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Alert,
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

export default function ShareCardScreen() {
  const router = useRouter();
  const { theme } = useSettings();
  const sessionCardRef = useRef<View>(null);
  const params = useLocalSearchParams();

  const exercises = params.exercises ? (JSON.parse(params.exercises as string) as LoggedExercise[]) : [];
  const dayName = (params.dayName as string) || '';
  const durationMinutes = parseInt(params.durationMinutes as string) || 0;

  const sessionTotalSets = exercises.reduce((s, ex) => s + ex.sets.filter(se => se.completed).length, 0);
  const sessionVolume = exercises.reduce(
    (sum, ex) => sum + ex.sets.filter(s => s.completed && s.weight != null).reduce((s, set) => s + (set.weight ?? 0) * set.reps, 0), 0
  );

  const handleShareSession = useCallback(async () => {
    if (!sessionCardRef.current) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to share.');
        return;
      }
      const uri = await captureRef(sessionCardRef.current, { format: 'png', quality: 1 });
      const asset = await MediaLibrary.createAssetAsync(uri);
      await Share.share({
        url: asset.uri,
        message: `Just finished ${dayName}: ${exercises.length} exercises, ${sessionTotalSets} sets in ${durationMinutes} min`,
      });
    } catch {}
  }, [dayName, exercises.length, sessionTotalSets, durationMinutes]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </Pressable>
        <Pressable onPress={handleShareSession}>
          <Ionicons name="share-social" size={24} color={theme.text} />
        </Pressable>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
        <View
          ref={sessionCardRef}
          collapsable={false}
          style={{ backgroundColor: theme.text, borderRadius: 16, padding: 20, width: '100%' }}
        >
          <Text style={{ fontSize: 12, fontWeight: '800', color: theme.background, letterSpacing: 2, marginBottom: 12 }}>FORME</Text>
          <Text style={{ fontSize: 24, fontWeight: '700', color: theme.background, marginBottom: 16 }}>{dayName}</Text>
          <View style={{ flexDirection: 'row', gap: 24 }}>
            <View>
              <Text style={{ fontSize: 28, fontWeight: '800', color: theme.background }}>{sessionTotalSets}</Text>
              <Text style={{ fontSize: 11, color: theme.background + '60', marginTop: 4 }}>SETS</Text>
            </View>
            <View>
              <Text style={{ fontSize: 28, fontWeight: '800', color: theme.background }}>{sessionVolume > 0 ? formatNumber(Math.round(sessionVolume)) : '\u2014'}</Text>
              <Text style={{ fontSize: 11, color: theme.background + '60', marginTop: 4 }}>VOLUME</Text>
            </View>
            <View>
              <Text style={{ fontSize: 28, fontWeight: '800', color: theme.background }}>{durationMinutes}</Text>
              <Text style={{ fontSize: 11, color: theme.background + '60', marginTop: 4 }}>MIN</Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
