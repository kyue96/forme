import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

interface FollowState {
  followingIds: Set<string>;
  loaded: boolean;

  loadFollowingIds: () => Promise<void>;
  followUser: (userId: string) => Promise<void>;
  unfollowUser: (userId: string) => Promise<void>;
  isFollowing: (userId: string) => boolean;
}

export const useFollowStore = create<FollowState>((set, get) => ({
  followingIds: new Set(),
  loaded: false,

  loadFollowingIds: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const ids = new Set((data ?? []).map((f) => f.following_id));
      set({ followingIds: ids, loaded: true });
    } catch {}
  },

  followUser: async (userId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id === userId) return;

      await supabase.from('follows').insert({
        follower_id: user.id,
        following_id: userId,
      });

      set((s) => {
        const next = new Set(s.followingIds);
        next.add(userId);
        return { followingIds: next };
      });
    } catch {}
  },

  unfollowUser: async (userId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('follows').delete().match({
        follower_id: user.id,
        following_id: userId,
      });

      set((s) => {
        const next = new Set(s.followingIds);
        next.delete(userId);
        return { followingIds: next };
      });
    } catch {}
  },

  isFollowing: (userId: string) => {
    return get().followingIds.has(userId);
  },
}));
