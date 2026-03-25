import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

import { supabase } from '@/lib/supabase';
import { usePlan } from '@/lib/plan-context';
import { useSettings } from '@/lib/settings-context';
import { useUserStore } from '@/lib/user-store';
import { isUnilateralExercise } from '@/lib/workout-metrics';
import { AvatarInitial } from '@/components/AvatarInitial';
import ColorWheel from '@/components/ColorWheel';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.85, 360);
const ANIMATION_DURATION = 350;

export function ProfileDrawer() {
  const router = useRouter();
  const { setPlan } = usePlan();
  const { theme, weightUnit, themeMode, setThemeMode } = useSettings();
  const {
    displayName, email, avatarUrl, avatarColor, followerCount, followingCount,
    drawerVisible, closeDrawer, updateDisplayName, updateAvatar, updateAvatarColor,
  } = useUserStore();

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(displayName);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [showWheel, setShowWheel] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const AVATAR_PRESET_COLORS = [
    '#F59E0B', '#EF4444', '#3B82F6', '#10B981', '#8B5CF6',
    '#EC4899', '#F97316',
  ];

  // Stats
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [streak, setStreak] = useState(0);
  const [totalVolume, setTotalVolume] = useState(0);
  const [avgCalories, setAvgCalories] = useState<number | null>(null);

  // Pro card
  const [proExpanded, setProExpanded] = useState(false);

  // Animation
  const translateX = useSharedValue(-DRAWER_WIDTH);
  const backdropOpacity = useSharedValue(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (drawerVisible) {
      setVisible(true);
      translateX.value = withTiming(0, { duration: ANIMATION_DURATION, easing: Easing.out(Easing.cubic) });
      backdropOpacity.value = withTiming(0.5, { duration: ANIMATION_DURATION });
    } else {
      translateX.value = withTiming(-DRAWER_WIDTH, { duration: ANIMATION_DURATION, easing: Easing.in(Easing.cubic) });
      backdropOpacity.value = withTiming(0, { duration: ANIMATION_DURATION }, () => {
        runOnJS(setVisible)(false);
      });
    }
  }, [drawerVisible]);

  useEffect(() => {
    setNameInput(displayName);
  }, [displayName]);

  useEffect(() => {
    if (drawerVisible) loadStats();
  }, [drawerVisible]);

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: logs } = await supabase
        .from('workout_logs')
        .select('completed_at, exercises, duration_minutes')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false });

      if (logs) {
        setTotalWorkouts(logs.length);

        const logDates = [...new Set(logs.map((l) => l.completed_at?.split('T')[0]).filter(Boolean))].sort().reverse();
        let s = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        for (let i = 0; i < logDates.length; i++) {
          const expected = new Date(today);
          expected.setDate(today.getDate() - i);
          if (logDates[i] === expected.toISOString().split('T')[0]) s++;
          else break;
        }
        setStreak(s);

        let vol = 0;
        for (const log of logs) {
          if (!log.exercises) continue;
          for (const ex of log.exercises) {
            const mul = isUnilateralExercise(ex.name) ? 2 : 1;
            for (const set of ex.sets ?? []) {
              if (set.completed && set.weight != null) {
                vol += set.weight * (set.reps ?? 0) * mul;
              }
            }
          }
        }
        setTotalVolume(Math.round(vol));
      }

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data: meals } = await supabase
        .from('meals')
        .select('calories, date')
        .eq('user_id', user.id)
        .gte('date', sevenDaysAgo.toISOString().split('T')[0]);

      if (meals && meals.length > 0) {
        const byDay: Record<string, number> = {};
        for (const m of meals) {
          byDay[m.date] = (byDay[m.date] ?? 0) + (m.calories ?? 0);
        }
        const days = Object.values(byDay);
        setAvgCalories(Math.round(days.reduce((a, b) => a + b, 0) / days.length));
      }
    } catch {}
  };

  const uploadAvatarImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to upload an avatar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setAvatarUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const rawExt = (asset.uri.split('.').pop() ?? 'jpg').toLowerCase();
      const ext = ['jpg', 'jpeg', 'png', 'webp'].includes(rawExt) ? rawExt : 'jpg';
      const path = `${user.id}.${ext}`;
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: `image/${ext}` });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      await supabase.from('profiles').upsert({ id: user.id, avatar_url: publicUrl });
      updateAvatar(publicUrl);
    } catch {
      Alert.alert('Upload failed', 'Could not upload photo. Try again.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const removeAvatar = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
      updateAvatar('');
    } catch {
      Alert.alert('Error', 'Could not remove photo.');
    }
  };

  const pickAvatar = () => {
    const options: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[] = [
      { text: 'Choose Photo', onPress: uploadAvatarImage },
    ];
    if (avatarUrl) {
      options.push({ text: 'Remove Photo', onPress: removeAvatar, style: 'destructive' });
    }
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Profile Photo', undefined, options);
  };

  const saveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    await updateDisplayName(trimmed);
    setEditingName(false);
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          closeDrawer();
          await supabase.auth.signOut();
          setPlan(null);
        },
      },
    ]);
  };

  const handleResetPlan = () => {
    Alert.alert('Rebuild Plan', 'Update your workout preferences and generate a new plan.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Rebuild',
        onPress: () => {
          closeDrawer();
          router.push('/quiz/1?mode=rebuild');
        },
      },
      {
        text: 'Start fresh',
        style: 'destructive',
        onPress: () => {
          closeDrawer();
          setPlan(null);
          router.push('/quiz/1');
        },
      },
    ]);
  };

  const formatVolume = (v: number): string => {
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return String(v);
  };

  const stats = [
    { label: 'Workouts', value: String(totalWorkouts), icon: 'barbell-outline' as const },
    { label: 'Streak', value: `${streak}d`, icon: 'flame-outline' as const },
    { label: `Vol (${weightUnit})`, value: formatVolume(totalVolume), icon: 'trending-up-outline' as const },
    { label: 'Avg cal', value: avgCalories != null ? String(avgCalories) : '-', icon: 'nutrition-outline' as const },
  ];

  if (!visible) return null;

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#000',
      }, backdropStyle]}>
        <Pressable style={{ flex: 1 }} onPress={closeDrawer} />
      </Animated.View>

      {/* Drawer panel */}
      <Animated.View style={[{
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        width: DRAWER_WIDTH,
        backgroundColor: theme.background,
        borderRightWidth: 1,
        borderRightColor: theme.border,
        shadowColor: '#000',
        shadowOffset: { width: 4, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 24,
      }, drawerStyle]}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={scrollEnabled}
        >
          {/* Close arrow */}
          <Pressable
            onPress={closeDrawer}
            hitSlop={16}
            style={{ position: 'absolute', top: 56, right: 16, zIndex: 10, padding: 4 }}
          >
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>

          {/* User section */}
          <View style={{ paddingHorizontal: 24, paddingTop: 60, paddingBottom: 24, alignItems: 'center' }}>
            {/* Avatar */}
            <View style={{ marginBottom: 12 }}>
              <Pressable onPress={pickAvatar}>
                {avatarUploading ? (
                  <View style={{
                    width: 72, height: 72, borderRadius: 36,
                    backgroundColor: theme.surface,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1, borderColor: theme.border,
                  }}>
                    <Ionicons name="cloud-upload-outline" size={32} color={theme.chrome} />
                  </View>
                ) : (
                  <AvatarInitial name={displayName} avatarUrl={avatarUrl} avatarColor={avatarColor} size={72} />
                )}
              </Pressable>
              {/* Camera icon */}
              <View style={{
                position: 'absolute', bottom: -4, right: -4,
                width: 24, height: 24, borderRadius: 12,
                backgroundColor: theme.text,
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 2, borderColor: theme.background,
              }}>
                <Ionicons name="camera" size={12} color={theme.background} />
              </View>
              {/* Color picker toggle */}
              <Pressable
                onPress={() => setColorPickerOpen(!colorPickerOpen)}
                style={{
                  position: 'absolute', bottom: -4, left: -4,
                  width: 24, height: 24, borderRadius: 12,
                  backgroundColor: theme.surface,
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 2, borderColor: theme.background,
                }}
              >
                <Ionicons name="color-palette" size={12} color={theme.chrome} />
              </Pressable>
            </View>

            {/* Color preset circles + rainbow wheel toggle */}
            {colorPickerOpen && (
              <View style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: showWheel ? 12 : 0 }}>
                  {AVATAR_PRESET_COLORS.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => { updateAvatarColor(c); setShowWheel(false); }}
                      style={{
                        width: 28, height: 28, borderRadius: 14,
                        backgroundColor: c,
                        borderWidth: avatarColor === c && !showWheel ? 3 : 0,
                        borderColor: '#FFFFFF',
                      }}
                    />
                  ))}
                  {/* Rainbow circle — toggles color wheel */}
                  <Pressable
                    onPress={() => setShowWheel((prev) => !prev)}
                    style={{
                      width: 32, height: 32, borderRadius: 16,
                      borderWidth: showWheel ? 3 : 1.5,
                      borderColor: showWheel ? '#FFFFFF' : 'rgba(255,255,255,0.3)',
                      overflow: 'hidden',
                      shadowColor: '#FF6BF5',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.8,
                      shadowRadius: 6,
                      elevation: 8,
                    }}
                  >
                    <View style={{ flex: 1, borderRadius: 16, overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap' }}>
                      {['#FF3B3B', '#FF8800', '#FFD600', '#00E05A', '#00BFFF', '#6B5BFF', '#D94BFF'].map((c, i) => (
                        <View key={i} style={{ width: i < 4 ? '25%' : '33.33%', height: '50%', backgroundColor: c }} />
                      ))}
                    </View>
                  </Pressable>
                </View>
                {/* Color wheel — shown when rainbow circle tapped */}
                {showWheel && (
                  <View style={{ alignItems: 'center', marginTop: 4 }}>
                    <ColorWheel
                      size={180}
                      currentColor={avatarColor || '#F59E0B'}
                      onColorSelect={(color) => updateAvatarColor(color)}
                      onInteractionStart={() => setScrollEnabled(false)}
                      onInteractionEnd={() => setScrollEnabled(true)}
                    />
                  </View>
                )}
              </View>
            )}

            {/* Name */}
            {editingName ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <TextInput
                  style={{
                    fontSize: 18, fontWeight: '700', color: theme.text,
                    borderBottomWidth: 1, borderBottomColor: theme.chrome,
                    paddingBottom: 2, minWidth: 120, textAlign: 'center',
                  }}
                  value={nameInput}
                  onChangeText={setNameInput}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={saveName}
                />
                <Pressable onPress={saveName}>
                  <Ionicons name="checkmark-circle" size={22} color={theme.text} />
                </Pressable>
                <Pressable onPress={() => { setEditingName(false); setNameInput(displayName); }}>
                  <Ionicons name="close-circle-outline" size={22} color={theme.chrome} />
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setEditingName(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>
                  {displayName}
                </Text>
                <Ionicons name="pencil-outline" size={14} color={theme.chrome} />
              </Pressable>
            )}

            <Text style={{ fontSize: 13, color: theme.textSecondary }}>{email}</Text>

            {/* Follower/Following counts */}
            <View style={{ flexDirection: 'row', gap: 24, marginTop: 12 }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>{followerCount}</Text>
                <Text style={{ fontSize: 11, color: theme.textSecondary }}>Followers</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>{followingCount}</Text>
                <Text style={{ fontSize: 11, color: theme.textSecondary }}>Following</Text>
              </View>
            </View>
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: theme.border, marginHorizontal: 24 }} />

          {/* General section */}
          <View style={{ paddingHorizontal: 24, paddingTop: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1.5 }}>
                General
              </Text>
              <Pressable
                onPress={() => {
                  // Detect current resolved theme from bg color
                  const isCurrentlyLight = theme.background === '#FFFFFF';
                  setThemeMode(isCurrentlyLight ? 'dark' : 'light');
                }}
                hitSlop={12}
                style={{ padding: 4 }}
              >
                <Ionicons
                  name={theme.background === '#FFFFFF' ? 'sunny-outline' : 'moon-outline'}
                  size={18}
                  color={theme.chrome}
                />
              </Pressable>
            </View>
            <DrawerRow icon="settings-outline" label="Settings" theme={theme} onPress={() => { closeDrawer(); router.push('/settings'); }} />
            <DrawerRow icon="refresh-outline" label="Rebuild my plan" theme={theme} onPress={handleResetPlan} />
          </View>

          {/* Progress section */}
          <View style={{ paddingHorizontal: 24, paddingTop: 20 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
              Progress
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {stats.map(({ label, value, icon }) => (
                <View
                  key={label}
                  style={{
                    width: '47%',
                    backgroundColor: theme.surface,
                    borderRadius: 16,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: theme.border,
                  }}
                >
                  <Ionicons name={icon} size={18} color={theme.chrome} style={{ marginBottom: 8 }} />
                  <Text style={{ fontSize: 24, fontWeight: '800', color: theme.text }}>{value}</Text>
                  <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>{label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Premium */}
          <View style={{ paddingHorizontal: 24, paddingTop: 20 }}>
            <Pressable
              onPress={() => setProExpanded(!proExpanded)}
              style={{ backgroundColor: theme.text, borderRadius: 20, overflow: 'hidden' }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 }}>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: theme.background }}>Forme Pro</Text>
                  <Text style={{ fontSize: 12, color: theme.background + '80', marginTop: 1 }}>$9.99/month · unlock all features</Text>
                </View>
                <Ionicons name={proExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.background + '80'} />
              </View>
              {proExpanded && (
                <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
                  <View style={{ height: 1, backgroundColor: theme.background + '20', marginBottom: 14 }} />
                  {[
                    'Full workout history & analytics',
                    'AI coaching (powered by Claude)',
                    'Workout recap cards',
                    'Video posts',
                    'Unlimited templates',
                    'Create your own challenges',
                  ].map((feature) => (
                    <View key={feature} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <Ionicons name="checkmark-circle" size={15} color={theme.background + 'CC'} />
                      <Text style={{ fontSize: 13, color: theme.background + 'CC', marginLeft: 8 }}>{feature}</Text>
                    </View>
                  ))}
                  <Pressable style={{ marginTop: 12, backgroundColor: theme.background, paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}>
                    <Text style={{ color: theme.text, fontWeight: '800', fontSize: 14 }}>Upgrade to Pro</Text>
                  </Pressable>
                </View>
              )}
            </Pressable>
          </View>

          {/* Sign out */}
          <View style={{ paddingHorizontal: 24, paddingTop: 20 }}>
            <DrawerRow icon="log-out-outline" label="Sign out" theme={theme} color="#EF4444" onPress={handleSignOut} />
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function DrawerRow({ icon, label, theme, color, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  theme: any;
  color?: string;
  onPress: () => void;
}) {
  const textColor = color ?? theme.text;
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: theme.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.border,
        marginBottom: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Ionicons name={icon} size={20} color={color ?? theme.chrome} />
        <Text style={{ fontSize: 15, fontWeight: '600', color: textColor }}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.chrome} />
    </Pressable>
  );
}
