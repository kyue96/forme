import { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';
import { useUserStore } from '@/lib/user-store';
import { useFollowStore } from '@/lib/follow-store';
import { AvatarInitial } from '@/components/AvatarInitial';

interface DiscoverUser {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  follower_count: number;
  is_currently_training: boolean;
}

export default function DiscoverScreen() {
  const router = useRouter();
  const { theme } = useSettings();
  const currentUserId = useUserStore((s) => s.userId);
  const { isFollowing, followUser, unfollowUser, loadFollowingIds, loaded } = useFollowStore();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DiscoverUser[]>([]);
  const [suggested, setSuggested] = useState<DiscoverUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSuggested, setLoadingSuggested] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!loaded) loadFollowingIds();
    loadSuggested();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => search(query.trim()), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const loadSuggested = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, bio, follower_count, is_currently_training')
        .neq('id', currentUserId ?? '')
        .order('follower_count', { ascending: false })
        .limit(20);
      setSuggested(data ?? []);
    } catch {} finally {
      setLoadingSuggested(false);
    }
  };

  const search = async (q: string) => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, bio, follower_count, is_currently_training')
        .ilike('display_name', `%${q}%`)
        .neq('id', currentUserId ?? '')
        .order('follower_count', { ascending: false })
        .limit(30);
      setResults(data ?? []);
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async (userId: string) => {
    if (isFollowing(userId)) {
      await unfollowUser(userId);
    } else {
      await followUser(userId);
    }
  };

  const displayList = query.trim() ? results : suggested;

  const renderUser = ({ item }: { item: DiscoverUser }) => {
    const following = isFollowing(item.id);
    return (
      <Pressable
        onPress={() => router.push(`/user/${item.id}` as any)}
        style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 16, paddingVertical: 12,
          gap: 12,
        }}
      >
        <AvatarInitial
          name={item.display_name ?? '?'}
          avatarUrl={item.avatar_url}
          size={44}
          isTraining={item.is_currently_training}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>
            {item.display_name ?? 'User'}
          </Text>
          {item.bio && (
            <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }} numberOfLines={1}>
              {item.bio}
            </Text>
          )}
          <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
            {item.follower_count} follower{item.follower_count !== 1 ? 's' : ''}
          </Text>
        </View>
        <Pressable
          onPress={() => handleFollowToggle(item.id)}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
            backgroundColor: following ? theme.surface : theme.text,
            borderWidth: following ? 1 : 0,
            borderColor: theme.border,
          }}
        >
          <Text style={{
            fontSize: 13, fontWeight: '600',
            color: following ? theme.text : theme.background,
          }}>
            {following ? 'Following' : 'Follow'}
          </Text>
        </Pressable>
      </Pressable>
    );
  };

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
          Discover
        </Text>
      </View>

      {/* Search bar */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: theme.surface, borderRadius: 12,
          paddingHorizontal: 12, borderWidth: 1, borderColor: theme.border,
        }}>
          <Ionicons name="search" size={18} color={theme.chrome} />
          <TextInput
            style={{
              flex: 1, paddingVertical: 10, paddingHorizontal: 8,
              fontSize: 15, color: theme.text,
            }}
            placeholder="Search by name..."
            placeholderTextColor={theme.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={theme.chrome} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Section label */}
      {!query.trim() && (
        <Text style={{
          fontSize: 11, fontWeight: '600', color: theme.textSecondary,
          textTransform: 'uppercase', letterSpacing: 1.5,
          paddingHorizontal: 16, paddingBottom: 8,
        }}>
          Suggested for you
        </Text>
      )}

      {/* Results */}
      {loading || loadingSuggested ? (
        <View style={{ paddingTop: 40, alignItems: 'center' }}>
          <ActivityIndicator color={theme.chrome} />
        </View>
      ) : displayList.length === 0 ? (
        <View style={{ paddingTop: 40, alignItems: 'center' }}>
          <Text style={{ fontSize: 14, color: theme.textSecondary }}>
            {query.trim() ? 'No users found' : 'No suggestions yet'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayList}
          keyExtractor={(item) => item.id}
          renderItem={renderUser}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </SafeAreaView>
  );
}
