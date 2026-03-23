/**
 * PR detection: compares a workout's exercises against existing personal records
 * and upserts any new PRs to the personal_records table.
 */
import { supabase } from './supabase';
import { computeE1RM } from './workout-metrics';
import type { LoggedExercise } from './types';

export interface DetectedPR {
  exerciseName: string;
  e1rm: number;
  weight: number;
  reps: number;
  previousE1rm: number | null;
}

/**
 * Detect and save PRs from a completed workout session.
 * Returns the list of new PRs detected.
 */
export async function detectAndSavePRs(
  userId: string,
  loggedExercises: LoggedExercise[],
): Promise<DetectedPR[]> {
  try {
    // 1. Compute best e1RM per exercise from this session
    const sessionBests: Record<string, { e1rm: number; weight: number; reps: number }> = {};

    for (const ex of loggedExercises) {
      for (const s of ex.sets) {
        if (!s.completed || !s.weight || s.weight <= 0 || s.reps <= 0) continue;
        const e1rm = computeE1RM(s.weight, s.reps);
        if (!sessionBests[ex.name] || e1rm > sessionBests[ex.name].e1rm) {
          sessionBests[ex.name] = { e1rm, weight: s.weight, reps: s.reps };
        }
      }
    }

    const exerciseNames = Object.keys(sessionBests);
    if (exerciseNames.length === 0) return [];

    // 2. Fetch existing PRs for these exercises
    const { data: existingPRs } = await supabase
      .from('personal_records')
      .select('exercise_name, e1rm')
      .eq('user_id', userId)
      .in('exercise_name', exerciseNames)
      .order('e1rm', { ascending: false });

    // Build map of current best e1RM per exercise
    const currentBests: Record<string, number> = {};
    for (const pr of existingPRs ?? []) {
      if (!currentBests[pr.exercise_name] || pr.e1rm > currentBests[pr.exercise_name]) {
        currentBests[pr.exercise_name] = Number(pr.e1rm);
      }
    }

    // 3. Detect new PRs
    const newPRs: DetectedPR[] = [];
    const inserts: any[] = [];

    for (const [name, best] of Object.entries(sessionBests)) {
      const currentBest = currentBests[name];
      // PR if no existing record or if this session beats it
      if (currentBest === undefined || best.e1rm > currentBest) {
        newPRs.push({
          exerciseName: name,
          e1rm: best.e1rm,
          weight: best.weight,
          reps: best.reps,
          previousE1rm: currentBest ?? null,
        });
        inserts.push({
          user_id: userId,
          exercise_name: name,
          e1rm: best.e1rm,
          weight: best.weight,
          reps: best.reps,
          previous_e1rm: currentBest ?? null,
          achieved_at: new Date().toISOString(),
        });
      }
    }

    // 4. Save new PRs
    if (inserts.length > 0) {
      await supabase.from('personal_records').insert(inserts);
    }

    return newPRs;
  } catch {
    return [];
  }
}
