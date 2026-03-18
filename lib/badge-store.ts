import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BADGES, BadgeDefinition } from './badge-definitions';

export interface BadgeStats {
  totalWorkouts: number;
  totalVolume: number;
  totalSets: number;
  currentStreak: number;
  longestStreak: number;
  heaviestSet: number;
  mostSetsInSession: number;
  totalPRs: number;
  uniqueExercises: number;
  uniqueCategories: number;
  weekendWarrior: number;
  earlyBird: number;
  exercisesUsed: string[];
  categoriesUsed: string[];
  lastWorkoutDate: string | null;
  personalRecords: Record<string, number>; // exercise name -> max weight
}

interface BadgeStore {
  earnedBadges: Record<string, { earnedAt: string }>;
  stats: BadgeStats;
  updateStatsFromWorkout: (workout: {
    exercises: { name: string; sets: { completed: boolean; weight: number | null; reps: number }[] }[];
    completedAt: string;
    categories: string[];
  }) => string[]; // returns newly earned badge IDs
  getProgress: (badge: BadgeDefinition) => { current: number; target: number; percent: number };
  resetStats: () => void;
}

const DEFAULT_STATS: BadgeStats = {
  totalWorkouts: 0,
  totalVolume: 0,
  totalSets: 0,
  currentStreak: 0,
  longestStreak: 0,
  heaviestSet: 0,
  mostSetsInSession: 0,
  totalPRs: 0,
  uniqueExercises: 0,
  uniqueCategories: 0,
  weekendWarrior: 0,
  earlyBird: 0,
  exercisesUsed: [],
  categoriesUsed: [],
  lastWorkoutDate: null,
  personalRecords: {},
};

export const useBadgeStore = create<BadgeStore>()(
  persist(
    (set, get) => ({
      earnedBadges: {},
      stats: { ...DEFAULT_STATS },

      updateStatsFromWorkout: (workout) => {
        const state = get();
        const stats = { ...state.stats };
        const earnedBadges = { ...state.earnedBadges };
        const newlyEarned: string[] = [];

        // Update basic counters
        stats.totalWorkouts += 1;

        // Calculate session volume and sets
        let sessionVolume = 0;
        let sessionSets = 0;
        const sessionExercises = new Set<string>();

        for (const ex of workout.exercises) {
          sessionExercises.add(ex.name.toLowerCase());
          for (const s of ex.sets) {
            if (s.completed) {
              sessionSets += 1;
              const vol = (s.weight ?? 0) * s.reps;
              sessionVolume += vol;
              if (s.weight != null && s.weight > stats.heaviestSet) {
                stats.heaviestSet = s.weight;
              }
              // Check PRs
              if (s.weight != null && s.weight > 0) {
                const exKey = ex.name.toLowerCase();
                const prev = stats.personalRecords[exKey] ?? 0;
                if (s.weight > prev) {
                  stats.personalRecords[exKey] = s.weight;
                  if (prev > 0) stats.totalPRs += 1; // only count if beating a previous record
                }
              }
            }
          }
        }

        stats.totalVolume += sessionVolume;
        stats.totalSets += sessionSets;
        if (sessionSets > stats.mostSetsInSession) {
          stats.mostSetsInSession = sessionSets;
        }

        // Update unique exercises
        const allExercises = new Set(stats.exercisesUsed);
        sessionExercises.forEach((e) => allExercises.add(e));
        stats.exercisesUsed = Array.from(allExercises);
        stats.uniqueExercises = allExercises.size;

        // Update unique categories
        const allCategories = new Set(stats.categoriesUsed);
        workout.categories.forEach((c) => allCategories.add(c));
        stats.categoriesUsed = Array.from(allCategories);
        stats.uniqueCategories = allCategories.size;

        // Streak calculation
        const today = workout.completedAt.split('T')[0];
        if (stats.lastWorkoutDate) {
          const lastDate = new Date(stats.lastWorkoutDate);
          const todayDate = new Date(today);
          const diffDays = Math.round((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            stats.currentStreak += 1;
          } else if (diffDays > 1) {
            stats.currentStreak = 1;
          }
          // same day = don't change streak
        } else {
          stats.currentStreak = 1;
        }
        if (stats.currentStreak > stats.longestStreak) {
          stats.longestStreak = stats.currentStreak;
        }
        stats.lastWorkoutDate = today;

        // Weekend warrior check
        const dow = new Date(workout.completedAt).getDay();
        if (dow === 0 || dow === 6) {
          stats.weekendWarrior = 1;
        }

        // Early bird check
        const hour = new Date(workout.completedAt).getHours();
        if (hour < 7) {
          stats.earlyBird = 1;
        }

        // Check all badges
        for (const badge of BADGES) {
          if (earnedBadges[badge.id]) continue;
          const value = (stats as any)[badge.statKey] ?? 0;
          if (value >= badge.threshold) {
            earnedBadges[badge.id] = { earnedAt: new Date().toISOString() };
            newlyEarned.push(badge.id);
          }
        }

        set({ stats, earnedBadges });
        return newlyEarned;
      },

      getProgress: (badge) => {
        const stats = get().stats;
        const current = Math.min((stats as any)[badge.statKey] ?? 0, badge.threshold);
        return {
          current,
          target: badge.threshold,
          percent: Math.min(current / badge.threshold, 1),
        };
      },

      resetStats: () => set({ stats: { ...DEFAULT_STATS }, earnedBadges: {} }),
    }),
    {
      name: 'forme-badges',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
