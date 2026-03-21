import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

interface UserState {
  userId: string | null;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  avatarColor: string | null;
  isPro: boolean;
  followerCount: number;
  followingCount: number;
  bio: string;
  gymName: string | null;
  gymPlaceId: string | null;
  createdAt: string | null;
  drawerVisible: boolean;

  loadUser: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  updateAvatar: (url: string) => void;
  updateAvatarColor: (color: string) => Promise<void>;
  updateBio: (bio: string) => Promise<void>;
  updateGym: (gymName: string | null, gymPlaceId: string | null) => Promise<void>;
  toggleDrawer: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  setTraining: (active: boolean) => Promise<void>;
  reset: () => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  userId: null,
  displayName: '',
  email: '',
  avatarUrl: null,
  avatarColor: null,
  isPro: false,
  followerCount: 0,
  followingCount: 0,
  bio: '',
  gymName: null,
  gymPlaceId: null,
  createdAt: null,
  drawerVisible: false,

  loadUser: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const name = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? '';

      // Try full social query first, fall back to basic if columns don't exist yet
      let profile: any = null;
      const { data: fullProfile, error: fullErr } = await supabase
        .from('profiles')
        .select('avatar_url, avatar_color, display_name, bio, is_pro, follower_count, following_count, gym_name, gym_place_id')
        .eq('id', user.id)
        .single();

      if (!fullErr) {
        profile = fullProfile;
      } else {
        // Fallback: only query columns that exist pre-migration
        const { data: basicProfile } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', user.id)
          .single();
        profile = basicProfile;
      }

      set({
        userId: user.id,
        createdAt: user.created_at ?? null,
        displayName: profile?.display_name ?? name,
        email: user.email ?? '',
        avatarUrl: profile?.avatar_url ?? null,
        avatarColor: profile?.avatar_color ?? null,
        isPro: profile?.is_pro ?? false,
        followerCount: profile?.follower_count ?? 0,
        followingCount: profile?.following_count ?? 0,
        bio: profile?.bio ?? '',
        gymName: profile?.gym_name ?? null,
        gymPlaceId: profile?.gym_place_id ?? null,
      });

      // Sync display_name to profiles if not set
      if (!profile?.display_name && name) {
        await supabase.from('profiles').upsert({ id: user.id, display_name: name });
      }
    } catch {}
  },

  updateDisplayName: async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const { userId } = get();
      if (!userId) return;
      await supabase.auth.updateUser({ data: { full_name: trimmed } });
      await supabase.from('profiles').upsert({ id: userId, display_name: trimmed });
      set({ displayName: trimmed });
    } catch {}
  },

  updateAvatar: (url: string) => {
    set({ avatarUrl: url });
  },

  updateAvatarColor: async (color: string) => {
    try {
      const { userId } = get();
      if (!userId) return;
      await supabase.from('profiles').upsert({ id: userId, avatar_color: color });
      set({ avatarColor: color });
    } catch {}
  },

  updateBio: async (bio: string) => {
    try {
      const { userId } = get();
      if (!userId) return;
      await supabase.from('profiles').upsert({ id: userId, bio });
      set({ bio });
    } catch {}
  },

  updateGym: async (gymName: string | null, gymPlaceId: string | null) => {
    try {
      const { userId } = get();
      if (!userId) return;
      await supabase.from('profiles').upsert({
        id: userId,
        gym_name: gymName,
        gym_place_id: gymPlaceId,
      });
      set({ gymName, gymPlaceId });
    } catch {}
  },

  toggleDrawer: () => set((s) => ({ drawerVisible: !s.drawerVisible })),
  openDrawer: () => set({ drawerVisible: true }),
  closeDrawer: () => set({ drawerVisible: false }),

  setTraining: async (active: boolean) => {
    try {
      const { userId } = get();
      if (!userId) return;
      await supabase.from('profiles').upsert({
        id: userId,
        is_currently_training: active,
        currently_training_since: active ? new Date().toISOString() : null,
      });
    } catch {}
  },

  reset: () => set({
    userId: null,
    displayName: '',
    email: '',
    avatarUrl: null,
    avatarColor: null,
    isPro: false,
    followerCount: 0,
    followingCount: 0,
    bio: '',
    gymName: null,
    gymPlaceId: null,
    drawerVisible: false,
  }),
}));
