import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useSettings } from '@/lib/settings-context';
import { useSocialStore } from '@/lib/social-store';
import { useUserStore } from '@/lib/user-store';
import { AppHeader } from '@/components/AppHeader';
import { FeedPost } from '@/components/social/FeedPost';

export default function SocialScreen() {
  const router = useRouter();
  const { theme } = useSettings();
  const {
    feedPosts, feedMode, loading, refreshing, hasMore,
    setFeedMode, loadFeed, getGymBuddyCount,
  } = useSocialStore();
  const { gymName, gymPlaceId } = useUserStore();
  const [gymBuddyCount, setGymBuddyCount] = useState(0);

  useFocusEffect(useCallback(() => {
    if (feedPosts.length === 0) loadFeed(true);
  }, []));

  useEffect(() => {
    if (gymPlaceId) {
      getGymBuddyCount(gymPlaceId).then(setGymBuddyCount);
    }
  }, [gymPlaceId]);

  const handleEndReached = () => {
    if (!loading && hasMore) loadFeed();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <AppHeader />

      {/* Feed mode toggle */}
      <View style={{
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
      }}>
        {(['following', 'discover'] as const).map((mode) => {
          const active = feedMode === mode;
          return (
            <Pressable
              key={mode}
              onPress={() => setFeedMode(mode)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: active ? theme.text : theme.surface,
                borderWidth: 1,
                borderColor: active ? theme.text : theme.border,
              }}
            >
              <Text style={{
                fontSize: 13,
                fontWeight: '600',
                color: active ? theme.background : theme.textSecondary,
                textTransform: 'capitalize',
              }}>
                {mode}
              </Text>
            </Pressable>
          );
        })}

        {/* Discover users button */}
        <Pressable
          onPress={() => router.push('/discover')}
          style={{
            marginLeft: 'auto',
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 20,
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.border,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Ionicons name="search" size={14} color={theme.chrome} />
          <Text style={{ fontSize: 13, color: theme.textSecondary }}>Find</Text>
        </Pressable>
      </View>

      {/* Gym buddy banner */}
      {gymName && gymBuddyCount > 0 && (
        <View style={{ marginHorizontal: 16, marginBottom: 12, backgroundColor: theme.chrome + '15', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="people" size={18} color={theme.chrome} />
          <Text style={{ fontSize: 13, color: theme.text, flex: 1 }}>
            <Text style={{ fontWeight: '700' }}>{gymBuddyCount}</Text> {gymBuddyCount === 1 ? 'other' : 'others'} at {gymName} today
          </Text>
        </View>
      )}

      {/* Feed list */}
      <FlatList
        data={feedPosts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <FeedPost post={item} />}
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        refreshing={refreshing}
        onRefresh={() => loadFeed(true)}
        ListEmptyComponent={() => (
          <View style={{ alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 }}>
            {loading ? (
              <ActivityIndicator size="large" color={theme.chrome} />
            ) : (
              <>
                <Ionicons name="people-outline" size={48} color={theme.border} />
                <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text, marginTop: 16, textAlign: 'center' }}>
                  {feedMode === 'following' ? 'No posts yet' : 'Nothing here yet'}
                </Text>
                <Text style={{ fontSize: 14, color: theme.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
                  {feedMode === 'following'
                    ? 'Follow people to see their workouts in your feed.'
                    : 'Be the first to share a workout!'}
                </Text>
                {feedMode === 'following' && (
                  <Pressable
                    onPress={() => router.push('/discover')}
                    style={{
                      marginTop: 20,
                      backgroundColor: theme.text,
                      paddingHorizontal: 24,
                      paddingVertical: 12,
                      borderRadius: 12,
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '600', color: theme.background }}>Find People</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        )}
        ListFooterComponent={() =>
          loading && feedPosts.length > 0 ? (
            <View style={{ paddingVertical: 20 }}>
              <ActivityIndicator color={theme.chrome} />
            </View>
          ) : null
        }
      />

      {/* FAB — create post */}
      <Pressable
        onPress={() => router.push('/create-post')}
        style={{
          position: 'absolute',
          bottom: 24,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: theme.text,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Ionicons name="add" size={28} color={theme.background} />
      </Pressable>
    </SafeAreaView>
  );
}
