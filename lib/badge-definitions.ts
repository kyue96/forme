import { Ionicons } from '@expo/vector-icons';

export type BadgeTier = 'bronze' | 'silver' | 'gold';
export type BadgeCategory = 'consistency' | 'volume' | 'milestones' | 'records' | 'variety';

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  category: BadgeCategory;
  tier: BadgeTier;
  threshold: number;
  statKey: string; // which stat to check against threshold
}

export const TIER_COLORS: Record<BadgeTier, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
};

export const CATEGORY_LABELS: Record<BadgeCategory, string> = {
  consistency: 'Consistency',
  volume: 'Volume',
  milestones: 'Milestones',
  records: 'Personal Records',
  variety: 'Variety',
};

export const BADGES: BadgeDefinition[] = [
  // Consistency
  { id: 'first-workout', name: 'First Step', description: 'Complete your first workout', icon: 'footsteps-outline', category: 'consistency', tier: 'bronze', threshold: 1, statKey: 'totalWorkouts' },
  { id: 'streak-7', name: '7-Day Streak', description: 'Work out 7 days in a row', icon: 'flame-outline', category: 'consistency', tier: 'bronze', threshold: 7, statKey: 'currentStreak' },
  { id: 'streak-14', name: '14-Day Streak', description: 'Work out 14 days in a row', icon: 'flame', category: 'consistency', tier: 'silver', threshold: 14, statKey: 'currentStreak' },
  { id: 'streak-30', name: '30-Day Streak', description: 'Work out 30 days in a row', icon: 'bonfire-outline', category: 'consistency', tier: 'gold', threshold: 30, statKey: 'currentStreak' },
  { id: 'weekend-warrior', name: 'Weekend Warrior', description: 'Complete workouts on both Sat & Sun', icon: 'sunny-outline', category: 'consistency', tier: 'bronze', threshold: 1, statKey: 'weekendWarrior' },
  { id: 'early-bird', name: 'Early Bird', description: 'Complete a workout before 7am', icon: 'alarm-outline', category: 'consistency', tier: 'bronze', threshold: 1, statKey: 'earlyBird' },
  { id: 'night-owl', name: 'Night Owl', description: 'Complete a workout after 9pm', icon: 'moon-outline', category: 'consistency', tier: 'bronze', threshold: 1, statKey: 'nightOwl' },
  { id: 'streak-60', name: '60-Day Streak', description: 'Maintain a 60-day streak', icon: 'bonfire', category: 'consistency', tier: 'gold', threshold: 60, statKey: 'longestStreak' },

  // Volume
  { id: 'volume-10k', name: '10K Club', description: 'Log 10,000 lbs total volume', icon: 'barbell-outline', category: 'volume', tier: 'bronze', threshold: 10000, statKey: 'totalVolume' },
  { id: 'volume-50k', name: '50K Club', description: 'Log 50,000 lbs total volume', icon: 'barbell', category: 'volume', tier: 'silver', threshold: 50000, statKey: 'totalVolume' },
  { id: 'volume-100k', name: '100K Club', description: 'Log 100,000 lbs total volume', icon: 'trophy', category: 'volume', tier: 'gold', threshold: 100000, statKey: 'totalVolume' },
  { id: 'heavy-lifter', name: 'Heavy Lifter', description: 'Complete a set with 200+ lbs', icon: 'shield-outline', category: 'volume', tier: 'silver', threshold: 200, statKey: 'heaviestSet' },
  { id: 'heavy-300', name: 'Titan', description: 'Complete a set with 300+ lbs', icon: 'shield', category: 'volume', tier: 'gold', threshold: 300, statKey: 'heaviestSet' },
  { id: 'volume-250k', name: '250K Club', description: 'Log 250,000 lbs total volume', icon: 'fitness-outline', category: 'volume', tier: 'gold', threshold: 250000, statKey: 'totalVolume' },
  { id: 'volume-500k', name: '500K Club', description: 'Log 500,000 lbs total volume', icon: 'fitness', category: 'volume', tier: 'gold', threshold: 500000, statKey: 'totalVolume' },
  { id: 'volume-1m', name: 'Million Pound Club', description: 'Log 1,000,000 lbs total volume', icon: 'diamond-outline', category: 'volume', tier: 'gold', threshold: 1000000, statKey: 'totalVolume' },

  // Milestones
  { id: 'workouts-10', name: 'Getting Started', description: 'Log 10 workouts', icon: 'star-outline', category: 'milestones', tier: 'bronze', threshold: 10, statKey: 'totalWorkouts' },
  { id: 'workouts-25', name: 'Quarter Century', description: 'Log 25 workouts', icon: 'star-half-outline', category: 'milestones', tier: 'silver', threshold: 25, statKey: 'totalWorkouts' },
  { id: 'workouts-50', name: 'Half Century', description: 'Log 50 workouts', icon: 'star', category: 'milestones', tier: 'silver', threshold: 50, statKey: 'totalWorkouts' },
  { id: 'workouts-100', name: 'Centurion', description: 'Log 100 workouts', icon: 'medal-outline', category: 'milestones', tier: 'gold', threshold: 100, statKey: 'totalWorkouts' },
  { id: 'sets-100', name: 'Century Sets', description: 'Complete 100 sets in one session', icon: 'infinite-outline', category: 'milestones', tier: 'gold', threshold: 100, statKey: 'mostSetsInSession' },
  { id: 'total-sets-1000', name: 'Set Machine', description: 'Complete 1,000 total sets', icon: 'layers-outline', category: 'milestones', tier: 'silver', threshold: 1000, statKey: 'totalSets' },
  { id: 'total-sets-5000', name: 'Set Legend', description: 'Complete 5,000 total sets', icon: 'layers', category: 'milestones', tier: 'gold', threshold: 5000, statKey: 'totalSets' },
  { id: 'workouts-200', name: 'Dedicated', description: 'Log 200 workouts', icon: 'medal', category: 'milestones', tier: 'gold', threshold: 200, statKey: 'totalWorkouts' },
  { id: 'workouts-365', name: 'Year of Iron', description: 'Log 365 workouts', icon: 'ribbon-outline', category: 'milestones', tier: 'gold', threshold: 365, statKey: 'totalWorkouts' },

  // Personal Records
  { id: 'pr-breaker', name: 'PR Breaker', description: 'Beat a previous weight PR', icon: 'trending-up-outline', category: 'records', tier: 'bronze', threshold: 1, statKey: 'totalPRs' },
  { id: 'pr-5', name: 'PR Machine', description: 'Set 5 personal records', icon: 'trending-up', category: 'records', tier: 'silver', threshold: 5, statKey: 'totalPRs' },
  { id: 'pr-20', name: 'Record Smasher', description: 'Set 20 personal records', icon: 'rocket-outline', category: 'records', tier: 'gold', threshold: 20, statKey: 'totalPRs' },
  { id: 'pr-50', name: 'Unstoppable', description: 'Set 50 personal records', icon: 'rocket', category: 'records', tier: 'gold', threshold: 50, statKey: 'totalPRs' },

  // Variety
  { id: 'exercises-10', name: 'Explorer', description: 'Try 10 different exercises', icon: 'compass-outline', category: 'variety', tier: 'bronze', threshold: 10, statKey: 'uniqueExercises' },
  { id: 'exercises-25', name: 'Adventurer', description: 'Try 25 different exercises', icon: 'map-outline', category: 'variety', tier: 'silver', threshold: 25, statKey: 'uniqueExercises' },
  { id: 'exercises-50', name: 'Master Explorer', description: 'Try 50 different exercises', icon: 'globe-outline', category: 'variety', tier: 'gold', threshold: 50, statKey: 'uniqueExercises' },
  { id: 'categories-5', name: 'Well Rounded', description: 'Work out 5+ muscle groups', icon: 'body-outline', category: 'variety', tier: 'bronze', threshold: 5, statKey: 'uniqueCategories' },
  { id: 'all-categories', name: 'Full Spectrum', description: 'Use all exercise categories', icon: 'color-palette-outline', category: 'variety', tier: 'gold', threshold: 10, statKey: 'uniqueCategories' },
];
