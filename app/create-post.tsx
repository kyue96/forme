import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';
import { useSocialStore } from '@/lib/social-store';
import { useUserStore } from '@/lib/user-store';
import { AvatarInitial } from '@/components/AvatarInitial';
import { CARD_THEMES, formatVolume, formatDuration } from '@/lib/card-themes';
import type { CardData } from '@/lib/social-types';

interface WorkoutLogEntry {
  id: string;
  day_name: string;
  exercises: any[];
  completed_at: string;
  duration_minutes: number | null;
}

export default function CreatePostScreen() {
  const router = useRouter();
  const { theme, weightUnit } = useSettings();
  const { displayName, avatarUrl } = useUserStore();
  const { createPost } = useSocialStore();
  const params = useLocalSearchParams<{
    cardData?: string;
    workoutLogId?: string;
  }>();

  const [caption, setCaption] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<WorkoutLogEntry | null>(null);
  const [cardData, setCardData] = useState<CardData | null>(
    params.cardData ? JSON.parse(params.cardData) : null
  );
  const [workoutLogId, setWorkoutLogId] = useState<string | null>(params.workoutLogId ?? null);
  const [recentLogs, setRecentLogs] = useState<WorkoutLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    loadRecentLogs();
  }, []);

  const loadRecentLogs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('workout_logs')
        .select('id, day_name, exercises, completed_at, duration_minutes')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(10);
      setRecentLogs(data ?? []);
    } catch {} finally {
      setLoadingLogs(false);
    }
  };

  const selectLog = (log: WorkoutLogEntry) => {
    setSelectedLog(log);
    setWorkoutLogId(log.id);

    // Build card data from log
    const exercises = log.exercises ?? [];
    const totalSets = exercises.reduce((s: number, ex: any) => s + (ex.sets ?? []).filter((st: any) => st.completed).length, 0);
    const totalReps = exercises.reduce(
      (s: number, ex: any) => s + (ex.sets ?? []).filter((st: any) => st.completed).reduce((r: number, st: any) => r + (st.reps ?? 0), 0), 0
    );
    const totalVol = exercises.reduce(
      (s: number, ex: any) => s + (ex.sets ?? []).filter((st: any) => st.completed && st.weight != null)
        .reduce((v: number, st: any) => v + (st.weight ?? 0) * (st.reps ?? 0), 0), 0
    );
    const displayVol = weightUnit === 'lbs' ? Math.round(totalVol * 2.205) : totalVol;

    setCardData({
      focus: log.day_name,
      dayName: new Date(log.completed_at).toLocaleDateString('en-US', { weekday: 'long' }),
      sets: totalSets,
      reps: totalReps,
      volume: displayVol,
      unitLabel: weightUnit,
      durationMinutes: log.duration_minutes ?? 0,
      muscles: [],
      themeIdx: 1,
    });
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to add an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handlePost = async () => {
    if (!caption.trim() && !cardData && !imageUri) {
      Alert.alert('Empty post', 'Add a caption, workout, or photo.');
      return;
    }

    setPosting(true);
    try {
      let imageUrl: string | null = null;

      // Upload image if selected
      if (imageUri) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const ext = (imageUri.split('.').pop() ?? 'jpg').toLowerCase();
          const path = `${user.id}/${Date.now()}.${ext}`;
          const response = await fetch(imageUri);
          const blob = await response.blob();
          const { error: uploadErr } = await supabase.storage
            .from('post-images')
            .upload(path, blob, { contentType: `image/${ext}` });
          if (!uploadErr) {
            const { data: { publicUrl } } = supabase.storage.from('post-images').getPublicUrl(path);
            imageUrl = publicUrl;
          }
        }
      }

      const postId = await createPost({
        type: cardData ? 'workout_recap' : imageUri ? 'photo' : 'workout_recap',
        caption: caption.trim() || undefined,
        workoutLogId: workoutLogId ?? undefined,
        cardData: cardData ?? undefined,
        imageUrl: imageUrl ?? undefined,
      });

      if (postId) {
        router.back();
      } else {
        Alert.alert('Error', 'Could not create post. Try again.');
      }
    } catch {
      Alert.alert('Error', 'Something went wrong.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: theme.border,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={24} color={theme.text} />
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>New Post</Text>
        <Pressable
          onPress={handlePost}
          disabled={posting}
          style={{
            backgroundColor: theme.text,
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
            opacity: posting ? 0.5 : 1,
          }}
        >
          {posting ? (
            <ActivityIndicator size="small" color={theme.background} />
          ) : (
            <Text style={{ fontSize: 14, fontWeight: '700', color: theme.background }}>Post</Text>
          )}
        </Pressable>
      </View>

      {/* Author row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 }}>
        <AvatarInitial name={displayName} avatarUrl={avatarUrl} size={36} />
        <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>{displayName}</Text>
      </View>

      {/* Caption input */}
      <View style={{ paddingHorizontal: 16 }}>
        <TextInput
          style={{
            fontSize: 16,
            color: theme.text,
            minHeight: 80,
            textAlignVertical: 'top',
          }}
          placeholder="What's on your mind?"
          placeholderTextColor={theme.textSecondary}
          value={caption}
          onChangeText={setCaption}
          multiline
          maxLength={500}
        />
      </View>

      {/* Selected card preview */}
      {cardData && (
        <View style={{
          marginHorizontal: 16, marginBottom: 12,
          backgroundColor: CARD_THEMES[cardData.themeIdx % CARD_THEMES.length].bg,
          borderRadius: 12, padding: 16,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: CARD_THEMES[cardData.themeIdx % CARD_THEMES.length].text }}>
                {cardData.focus}
              </Text>
              <Text style={{ fontSize: 11, color: CARD_THEMES[cardData.themeIdx % CARD_THEMES.length].sub }}>
                {cardData.sets} sets · {cardData.reps} reps · {formatDuration(cardData.durationMinutes)}
              </Text>
            </View>
            <Pressable onPress={() => { setCardData(null); setSelectedLog(null); setWorkoutLogId(null); }}>
              <Ionicons name="close-circle" size={20} color={CARD_THEMES[cardData.themeIdx % CARD_THEMES.length].sub} />
            </Pressable>
          </View>
        </View>
      )}

      {/* Selected image preview */}
      {imageUri && (
        <View style={{ marginHorizontal: 16, marginBottom: 12, borderRadius: 12, overflow: 'hidden' }}>
          <Image source={{ uri: imageUri }} style={{ width: '100%', aspectRatio: 4 / 3 }} />
          <Pressable
            onPress={() => setImageUri(null)}
            style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 4 }}
          >
            <Ionicons name="close" size={16} color="#FFF" />
          </Pressable>
        </View>
      )}

      {/* Action buttons */}
      <View style={{
        flexDirection: 'row', gap: 12,
        paddingHorizontal: 16, paddingVertical: 12,
        borderTopWidth: 1, borderTopColor: theme.border,
      }}>
        <Pressable
          onPress={pickImage}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingHorizontal: 12, paddingVertical: 8,
            backgroundColor: theme.surface, borderRadius: 12,
            borderWidth: 1, borderColor: theme.border,
          }}
        >
          <Ionicons name="image-outline" size={18} color={theme.chrome} />
          <Text style={{ fontSize: 13, color: theme.textSecondary }}>Photo</Text>
        </Pressable>
      </View>

      {/* Recent workouts to attach */}
      {!cardData && (
        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: 11, fontWeight: '600', color: theme.textSecondary,
            textTransform: 'uppercase', letterSpacing: 1.5,
            paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
          }}>
            Attach a workout
          </Text>
          {loadingLogs ? (
            <ActivityIndicator style={{ marginTop: 20 }} color={theme.chrome} />
          ) : recentLogs.length === 0 ? (
            <Text style={{ paddingHorizontal: 16, fontSize: 13, color: theme.textSecondary }}>
              No recent workouts to attach
            </Text>
          ) : (
            <FlatList
              data={recentLogs}
              keyExtractor={(item) => item.id}
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 16 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => selectLog(item)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    backgroundColor: theme.surface, borderRadius: 12,
                    padding: 14, marginBottom: 8,
                    borderWidth: 1, borderColor: theme.border,
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>
                      {item.day_name}
                    </Text>
                    <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                      {new Date(item.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {item.duration_minutes ? ` · ${item.duration_minutes}m` : ''}
                    </Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={22} color={theme.chrome} />
                </Pressable>
              )}
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}
