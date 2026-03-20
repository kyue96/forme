import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { PostWithAuthor, CardData, Comment } from '@/lib/social-types';

const PAGE_SIZE = 20;

interface SocialState {
  feedPosts: PostWithAuthor[];
  feedMode: 'following' | 'discover';
  loading: boolean;
  refreshing: boolean;
  hasMore: boolean;
  cursor: string | null;

  _lastPostTime: number;
  setFeedMode: (mode: 'following' | 'discover') => void;
  loadFeed: (refresh?: boolean) => Promise<void>;
  createPost: (data: {
    type: 'workout_recap' | 'photo' | 'program_share';
    caption?: string;
    workoutLogId?: string;
    cardData?: CardData;
    imageUrl?: string;
    programData?: any;
  }) => Promise<string | null>;
  deletePost: (postId: string) => Promise<void>;
  toggleReaction: (postId: string, emoji: string) => Promise<void>;
  loadComments: (postId: string) => Promise<Comment[]>;
  addComment: (postId: string, body: string) => Promise<Comment | null>;
  deleteComment: (commentId: string, postId: string) => Promise<void>;
  getGymBuddyCount: (placeId: string) => Promise<number>;
  saveWorkoutFromPost: (cardData: CardData) => Promise<boolean>;
}

export const useSocialStore = create<SocialState>((set, get) => ({
  feedPosts: [],
  feedMode: 'discover',
  loading: false,
  refreshing: false,
  hasMore: true,
  cursor: null,
  _lastPostTime: 0,

  setFeedMode: (mode) => {
    set({ feedMode: mode, feedPosts: [], cursor: null, hasMore: true });
    get().loadFeed(true);
  },

  loadFeed: async (refresh = false) => {
    const { loading, hasMore, cursor, feedMode } = get();
    if (loading || (!refresh && !hasMore)) return;

    set(refresh ? { refreshing: true, cursor: null } : { loading: true });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('posts')
        .select('*, profiles!user_id(id, display_name, avatar_url, is_currently_training, gym_name)')
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (feedMode === 'following') {
        // Get posts from people the user follows
        const { data: follows } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);

        const followingIds = follows?.map((f) => f.following_id) ?? [];
        // Include own posts too
        followingIds.push(user.id);
        query = query.in('user_id', followingIds);
      } else {
        // Discover: public posts
        query = query.eq('visibility', 'public');
      }

      const effectiveCursor = refresh ? null : cursor;
      if (effectiveCursor) {
        query = query.lt('created_at', effectiveCursor);
      }

      const { data: posts, error } = await query;

      if (error) throw error;

      // Get current user's reactions for these posts
      const postIds = (posts ?? []).map((p) => p.id);
      const { data: reactions } = postIds.length > 0
        ? await supabase
            .from('post_reactions')
            .select('post_id, emoji')
            .eq('user_id', user.id)
            .in('post_id', postIds)
        : { data: [] };

      const reactionMap: Record<string, string[]> = {};
      for (const r of reactions ?? []) {
        if (!reactionMap[r.post_id]) reactionMap[r.post_id] = [];
        if (!reactionMap[r.post_id].includes(r.emoji)) {
          reactionMap[r.post_id].push(r.emoji);
        }
      }

      const enrichedPosts: PostWithAuthor[] = (posts ?? []).map((p) => ({
        ...p,
        user_reactions: reactionMap[p.id] ?? [],
      }));

      const newCursor = enrichedPosts.length > 0
        ? enrichedPosts[enrichedPosts.length - 1].created_at
        : null;

      // Deduplicate posts by ID when paginating
      const existingPosts = refresh ? [] : get().feedPosts;
      const existingIds = new Set(existingPosts.map((p) => p.id));
      const newPosts = enrichedPosts.filter((p) => !existingIds.has(p.id));

      set({
        feedPosts: refresh ? enrichedPosts : [...existingPosts, ...newPosts],
        cursor: newCursor,
        hasMore: (posts ?? []).length === PAGE_SIZE,
      });
    } catch (err: any) {
      // Silently handle missing tables (migration not yet applied)
      if (err?.code !== 'PGRST205') {
        console.error('Feed load error:', err);
      }
    } finally {
      set({ loading: false, refreshing: false });
    }
  },

  createPost: async (data) => {
    try {
      // Prevent duplicate posts within 5 seconds
      const now = Date.now();
      if (now - get()._lastPostTime < 5000) return null;
      set({ _lastPostTime: now });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: post, error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          type: data.type,
          caption: data.caption ?? null,
          workout_log_id: data.workoutLogId ?? null,
          card_data: data.cardData ?? null,
          image_url: data.imageUrl ?? null,
          program_data: data.programData ?? null,
          visibility: 'public',
        })
        .select('*, profiles!user_id(id, display_name, avatar_url, is_currently_training, gym_name)')
        .single();

      if (error) throw error;

      // Prepend to feed
      set({ feedPosts: [{ ...post, user_reactions: [] }, ...get().feedPosts] });
      return post.id;
    } catch (err) {
      console.error('Create post error:', err);
      return null;
    }
  },

  deletePost: async (postId) => {
    try {
      await supabase.from('posts').delete().eq('id', postId);
      set({ feedPosts: get().feedPosts.filter((p) => p.id !== postId) });
    } catch {}
  },

  toggleReaction: async (postId, emoji) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const post = get().feedPosts.find((p) => p.id === postId);
      if (!post) return;

      const currentReactions = post.user_reactions ?? [];
      const hasThisEmoji = currentReactions.includes(emoji);

      if (hasThisEmoji) {
        // Toggle off: remove this reaction
        await supabase
          .from('post_reactions')
          .delete()
          .match({ post_id: postId, user_id: user.id, emoji });

        set({
          feedPosts: get().feedPosts.map((p) =>
            p.id === postId
              ? { ...p, like_count: Math.max(0, p.like_count - 1), user_reactions: [] }
              : p
          ),
        });
      } else {
        // One reaction per user: delete any existing reaction first, then insert new
        const hadPrevious = currentReactions.length > 0;
        if (hadPrevious) {
          await supabase
            .from('post_reactions')
            .delete()
            .eq('post_id', postId)
            .eq('user_id', user.id);
        }

        await supabase
          .from('post_reactions')
          .insert({ post_id: postId, user_id: user.id, emoji });

        set({
          feedPosts: get().feedPosts.map((p) =>
            p.id === postId
              ? { ...p, like_count: hadPrevious ? p.like_count : p.like_count + 1, user_reactions: [emoji] }
              : p
          ),
        });
      }
    } catch {}
  },

  loadComments: async (postId) => {
    try {
      const { data } = await supabase
        .from('comments')
        .select('*, profiles!user_id(id, display_name, avatar_url, is_currently_training, gym_name)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })
        .limit(100);

      return (data ?? []) as Comment[];
    } catch {
      return [];
    }
  },

  addComment: async (postId, body) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: comment, error } = await supabase
        .from('comments')
        .insert({ post_id: postId, user_id: user.id, body })
        .select('*, profiles!user_id(id, display_name, avatar_url, is_currently_training, gym_name)')
        .single();

      if (error) throw error;

      // Update comment count in feed
      set({
        feedPosts: get().feedPosts.map((p) =>
          p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p
        ),
      });

      return comment as Comment;
    } catch {
      return null;
    }
  },

  deleteComment: async (commentId, postId) => {
    try {
      await supabase.from('comments').delete().eq('id', commentId);
      set({
        feedPosts: get().feedPosts.map((p) =>
          p.id === postId ? { ...p, comment_count: Math.max(0, p.comment_count - 1) } : p
        ),
      });
    } catch {}
  },

  getGymBuddyCount: async (placeId: string): Promise<number> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabase
        .from('workout_logs')
        .select('user_id', { count: 'exact', head: true })
        .eq('user_id', user.id) // will be overridden below
        .gte('completed_at', today + 'T00:00:00')
        .lte('completed_at', today + 'T23:59:59');

      // Get profiles with same gym
      const { data: gymProfiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('gym_place_id', placeId)
        .neq('id', user.id);

      if (!gymProfiles || gymProfiles.length === 0) return 0;

      const gymUserIds = gymProfiles.map((p) => p.id);
      const { count: buddyCount } = await supabase
        .from('workout_logs')
        .select('user_id', { count: 'exact', head: true })
        .in('user_id', gymUserIds)
        .gte('completed_at', today + 'T00:00:00')
        .lte('completed_at', today + 'T23:59:59');

      return buddyCount ?? 0;
    } catch {
      return 0;
    }
  },

  saveWorkoutFromPost: async (cardData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      await supabase.from('saved_programs').insert({
        user_id: user.id,
        name: cardData.focus,
        exercises: [],
        card_data: cardData,
        source: 'social_feed',
      });
      return true;
    } catch {
      return false;
    }
  },
}));
