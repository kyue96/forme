/**
 * Advanced workout metrics calculations.
 * All functions operate on LoggedExercise[] arrays.
 */
import { LoggedExercise, LoggedSet } from './types';
import { getExerciseCategory } from './exercise-utils';
import { formatNumber } from './utils';

// ── Metric 1: Total Volume ──

/** Sum of (weight x reps) for all completed sets. */
export function computeTotalVolume(exercises: LoggedExercise[]): number {
  let total = 0;
  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (s.completed && s.weight && s.reps > 0) {
        total += s.weight * s.reps;
      }
    }
  }
  return Math.round(total);
}

// ── Metric 2: Estimated 1-Rep Max (Epley formula) ──

/** Epley formula: e1RM = weight x (1 + reps / 30). Returns 0 for invalid input. */
export function computeE1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight; // Actual 1RM
  return Math.round(weight * (1 + reps / 30));
}

export interface E1RMResult {
  exerciseName: string;
  weight: number;
  reps: number;
  e1rm: number;
}

/** Returns the top N exercises by estimated 1RM from the session. */
export function computeTopE1RMs(exercises: LoggedExercise[], limit = 3): E1RMResult[] {
  const bestPerExercise: Record<string, E1RMResult> = {};

  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (!s.completed || !s.weight || s.reps <= 0) continue;
      const e1rm = computeE1RM(s.weight, s.reps);
      const current = bestPerExercise[ex.name];
      if (!current || e1rm > current.e1rm) {
        bestPerExercise[ex.name] = {
          exerciseName: ex.name,
          weight: s.weight,
          reps: s.reps,
          e1rm,
        };
      }
    }
  }

  return Object.values(bestPerExercise)
    .sort((a, b) => b.e1rm - a.e1rm)
    .slice(0, limit);
}

// ── Metric 3: Volume Per Muscle Group ──

export interface MuscleVolume {
  muscle: string;
  volume: number;
  percentage: number; // 0-100
}

/** Sum volume grouped by muscle category. Sorted by volume descending. */
export function computeVolumeByMuscle(exercises: LoggedExercise[]): MuscleVolume[] {
  const volumeMap: Record<string, number> = {};

  for (const ex of exercises) {
    const category = getExerciseCategory(ex.name) ?? 'Other';
    let exVolume = 0;
    for (const s of ex.sets) {
      if (s.completed && s.weight && s.reps > 0) {
        exVolume += s.weight * s.reps;
      }
    }
    volumeMap[category] = (volumeMap[category] ?? 0) + exVolume;
  }

  const totalVolume = Object.values(volumeMap).reduce((a, b) => a + b, 0) || 1;

  return Object.entries(volumeMap)
    .map(([muscle, volume]) => ({
      muscle,
      volume: Math.round(volume),
      percentage: Math.round((volume / totalVolume) * 100),
    }))
    .sort((a, b) => b.volume - a.volume);
}

// ── Metric 4: Workout Density (volume per minute) ──

/** Total volume divided by duration in minutes. */
export function computeDensity(exercises: LoggedExercise[], durationMinutes: number): number {
  if (durationMinutes <= 0) return 0;
  const volume = computeTotalVolume(exercises);
  return Math.round(volume / durationMinutes);
}

// ── Metric 5: Average Training Intensity (% of e1RM) ──

/** Average (working weight / exercise e1RM) x 100 across all weighted sets. */
export function computeAvgIntensity(exercises: LoggedExercise[]): number {
  // First compute best e1RM per exercise
  const bestE1RM: Record<string, number> = {};
  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (!s.completed || !s.weight || s.reps <= 0) continue;
      const e1rm = computeE1RM(s.weight, s.reps);
      if (!bestE1RM[ex.name] || e1rm > bestE1RM[ex.name]) {
        bestE1RM[ex.name] = e1rm;
      }
    }
  }

  // Then compute average intensity across all sets
  let totalIntensity = 0;
  let setCount = 0;
  for (const ex of exercises) {
    const e1rm = bestE1RM[ex.name];
    if (!e1rm) continue;
    for (const s of ex.sets) {
      if (!s.completed || !s.weight || s.reps <= 0) continue;
      totalIntensity += (s.weight / e1rm) * 100;
      setCount++;
    }
  }

  return setCount > 0 ? Math.round(totalIntensity / setCount) : 0;
}

// ── Metric 6: Best Set ──

export interface BestSetResult {
  exerciseName: string;
  weight: number;
  reps: number;
}

/** Returns the single set with highest volume (weight × reps). */
export function computeBestSet(exercises: LoggedExercise[]): BestSetResult | null {
  let best: BestSetResult | null = null;
  let bestVolume = 0;

  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (!s.completed || !s.weight || s.reps <= 0) continue;
      const vol = s.weight * s.reps;
      if (vol > bestVolume) {
        bestVolume = vol;
        best = { exerciseName: ex.name, weight: s.weight, reps: s.reps };
      }
    }
  }

  return best;
}

// ── Metric 7: Volume Comparison ──

/** Returns a fun comparison string for the total volume lifted (in lbs). */
export function getVolumeComparison(volumeLbs: number): string {
  if (volumeLbs >= 100_000) return 'weight of a blue whale\'s heart';
  if (volumeLbs >= 50_000) return 'weight of a fighter jet';
  if (volumeLbs >= 20_000) return 'weight of a school bus';
  if (volumeLbs >= 10_000) return 'weight of a baby elephant';
  if (volumeLbs >= 5_000) return 'weight of a hippo\'s jaw';
  if (volumeLbs >= 2_000) return 'weight of a grand piano';
  if (volumeLbs >= 500) return 'weight of a grizzly bear cub';
  return 'weight of a golden retriever';
}

// ── Formatting helpers ──

/** "You moved 12,450 lbs of iron" */
export function formatVolumeHeadline(volume: number, unit: string): string {
  return `You moved ${formatNumber(volume)} ${unit} of iron`;
}

/** "1,200 lbs/min" */
export function formatDensity(density: number, unit: string): string {
  return `${formatNumber(density)} ${unit}/min`;
}

/** "78% of max" */
export function formatIntensity(intensity: number): string {
  if (intensity <= 0) return 'N/A';
  return `${intensity}% of max`;
}

/** Returns intensity zone label based on percentage. */
export function getIntensityZone(intensity: number): string {
  if (intensity >= 85) return 'Strength';
  if (intensity >= 70) return 'Hypertrophy';
  if (intensity >= 55) return 'Endurance';
  return 'Warm-up';
}
