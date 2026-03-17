export interface PostAuthor {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  is_currently_training: boolean;
  gym_name?: string | null;
}

export interface Post {
  id: string;
  user_id: string;
  type: 'workout_recap' | 'photo' | 'program_share' | 'challenge_update';
  caption: string | null;
  workout_log_id: string | null;
  card_data: CardData | null;
  image_url: string | null;
  program_data: any;
  visibility: 'public' | 'followers' | 'private';
  like_count: number;
  comment_count: number;
  created_at: string;
}

export interface PostWithAuthor extends Post {
  profiles: PostAuthor;
  user_reactions?: string[]; // emojis the current user has reacted with
}

export interface CardData {
  focus: string;
  dayName: string;
  sets: number;
  reps: number;
  volume: number;
  unitLabel: string;
  durationMinutes: number;
  muscles: string[];
  themeIdx: number;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles: PostAuthor;
}

export interface Reaction {
  id: string;
  post_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export const REACTION_EMOJIS = ['🔥', '💪', '👏', '❤️', '💯'] as const;
export type ReactionEmoji = typeof REACTION_EMOJIS[number];
