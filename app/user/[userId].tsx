import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';
import { useUserStore } from '@/lib/user-store';
import { useFollowStore } from '@/lib/follow-store';
import { AvatarInitial } from '@/components/AvatarInitial';
import { FeedPost } from '@/components/social/FeedPost';
import type { PostWithAuthor } from '@/lib/social-types';

interface UserProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  follower_count: number;
  following_count: number;
  is_currently_training: boolean;
}

export default function UserProfileScreen() {
  const router = useRouter();
  const { userId: paramId } = useLocalSearchParams<{ userId: string }>();
  const { theme, weightUnit } = useSettings();
  const currentUserId = useUserStore((s) => s.userId);
  const { isFollowing, followUser, unfollowUser, loadFollowingIds, loaded } = useFollowStore();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalWorkouts, setTotalWorkouts] = useState(0);

  const isOwn = paramId === currentUserId;
  const following = isFollowing(paramId ?? '');

  useEffect(() => {
    if (!loaded) loadFollowingIds();
    if (paramId) loadProfile();
  }, [paramId]);

  const loadProfile = async () => {
    if (!paramId) return;
    setLoading(true);
    try {
      // Load profile
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, bio, follower_count, following_count, is_currently_training')
        .eq('id', paramId)
        .single();

      if (prof) setProfile(prof);

      // Load their posts
      const { data: userPosts } = await supabase
        .from('posts')
        .select('*, profiles!user_id(id, display_name, avatar_url, is_currently_training)')
        .eq('user_id', paramId)
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(30);

      // Get current user reactions
      const { data: { user } } = await supabase.auth.getUser();
      const postIds = (userPosts ?? []).map((p) => p.id);
      const { data: reactions } = postIds.length > 0 && user
        ? await supabase
            .from('post_reactions')
            .select('post_id, emoji')
            .eq('user_id', user.id)
            .in('post_id', postIds)
        : { data: [] };

      const reactionMap: Record<string, string[]> = {};
      for (const r of reactions ?? []) {
        if (!reactionMap[r.post_id]) reactionMap[r.post_id] = [];
        reactionMap[r.post_id].push(r.emoji);
      }

      setPosts((userPosts ?? []).map((p) => ({
        ...p,
        user_reactions: reactionMap[p.id] ?? [],
      })));

      // Workout count
      const { count } = await supabase
        .from('workout_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', paramId);
      setTotalWorkouts(count ?? 0);
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!paramId) return;
    if (following) {
      await unfollowUser(paramId);
      if (profile) setProfile({ ...profile, follower_count: Math.max(0, profile.follower_count - 1) });
    } else {
      await followUser(paramId);
      if (profile) setProfile({ ...profile, follower_count: profile.follower_count + 1 });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={theme.chrome} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: theme.border,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text, marginLeft: 12 }}>
          {profile?.display_name ?? 'Profile'}
        </Text>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <FeedPost post={item} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={() => (
          <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 }}>
            {/* Profile info */}
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <AvatarInitial
                name={profile?.display_name ?? '?'}
                avatarUrl={profile?.avatar_url}
                size={80}
                isTraining={profile?.is_currently_training}
              />
              <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text, marginTop: 12 }}>
                {profile?.display_name ?? 'User'}
              </Text>
              {profile?.bio && (
                <Text style={{ fontSize: 14, color: theme.textSecondary, marginTop: 4, textAlign: 'center' }}>
                  {profile.bio}
                </Text>
              )}
              {profile?.is_currently_training && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  marginTop: 8, backgroundColor: '#22C55E20',
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' }} />
                  <Text style={{ fontSize: 12, color: '#22C55E', fontWeight: '600' }}>Currently training</Text>
                </View>
              )}
            </View>

            {/* Stats row */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 32, marginBottom: 20 }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>{totalWorkouts}</Text>
                <Text style={{ fontSize: 11, color: theme.textSecondary }}>Workouts</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>{profile?.follower_count ?? 0}</Text>
                <Text style={{ fontSize: 11, color: theme.textSecondary }}>Followers</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>{profile?.following_count ?? 0}</Text>
                <Text style={{ fontSize: 11, color: theme.textSecondary }}>Following</Text>
              </View>
            </View>

            {/* Follow button */}
            {!isOwn && (
              <Pressable
                onPress={handleFollowToggle}
                style={{
                  backgroundColor: following ? theme.surface : theme.text,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  borderWidth: following ? 1 : 0,
                  borderColor: theme.border,
                  marginBottom: 8,
                }}
              >
                <Text style={{
                  fontSize: 14, fontWeight: '700',
                  color: following ? theme.text : theme.background,
                }}>
                  {following ? 'Following' : 'Follow'}
                </Text>
              </Pressable>
            )}

            {/* Posts section header */}
            {posts.length > 0 && (
              <Text style={{
                fontSize: 11, fontWeight: '600', color: theme.textSecondary,
                textTransform: 'uppercase', letterSpacing: 1.5,
                marginTop: 16, marginBottom: 4,
              }}>
                Posts
              </Text>
            )}
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <Text style={{ fontSize: 14, color: theme.textSecondary }}>No posts yet</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
