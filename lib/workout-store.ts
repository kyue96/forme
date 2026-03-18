import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LoggedExercise } from './types';

interface ActiveWorkout {
  dayIndex: number;
  dayName: string;
  focus: string;
  loggedExercises: LoggedExercise[];
  startTime: number;
  elapsedMs: number; // ms elapsed before last pause
  isPaused: boolean;
  warmupDone: boolean;
  createdAt: number; // epoch ms — when the session was first created
}

interface WorkoutStore {
  activeWorkout: ActiveWorkout | null;
  _hasHydrated: boolean;
  startWorkout: (dayIndex: number, dayName: string, focus: string, exercises: LoggedExercise[]) => void;
  updateExercises: (exercises: LoggedExercise[]) => void;
  setWarmupDone: (done: boolean) => void;
  pauseWorkout: () => void;
  resumeWorkout: () => void;
  clearWorkout: () => void;
  getElapsedMs: () => number;
}

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set, get) => ({
      activeWorkout: null,
      _hasHydrated: false,

      startWorkout: (dayIndex, dayName, focus, exercises) => {
        set({
          activeWorkout: {
            dayIndex,
            dayName,
            focus,
            loggedExercises: exercises,
            startTime: Date.now(),
            elapsedMs: 0,
            isPaused: false,
            warmupDone: false,
            createdAt: Date.now(),
          },
        });
      },

      updateExercises: (exercises) => {
        set((state) => ({
          activeWorkout: state.activeWorkout
            ? { ...state.activeWorkout, loggedExercises: exercises }
            : null,
        }));
      },

      setWarmupDone: (done) => {
        set((state) => ({
          activeWorkout: state.activeWorkout
            ? { ...state.activeWorkout, warmupDone: done }
            : null,
        }));
      },

      pauseWorkout: () => {
        const aw = get().activeWorkout;
        if (!aw || aw.isPaused) return;
        const nowMs = aw.elapsedMs + (Date.now() - aw.startTime);
        set((state) => ({
          activeWorkout: state.activeWorkout
            ? { ...state.activeWorkout, elapsedMs: nowMs, isPaused: true }
            : null,
        }));
      },

      resumeWorkout: () => {
        set((state) => ({
          activeWorkout: state.activeWorkout
            ? { ...state.activeWorkout, startTime: Date.now(), isPaused: false }
            : null,
        }));
      },

      clearWorkout: () => set({ activeWorkout: null }),

      getElapsedMs: () => {
        const aw = get().activeWorkout;
        if (!aw) return 0;
        if (aw.isPaused) return aw.elapsedMs;
        return aw.elapsedMs + (Date.now() - aw.startTime);
      },
    }),
    {
      name: '@forme/active-workout',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ activeWorkout: state.activeWorkout }),
      onRehydrateStorage: () => () => {
        useWorkoutStore.setState({ _hasHydrated: true });
      },
    },
  ),
);
