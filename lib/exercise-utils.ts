// Utility to derive muscle group categories from exercise names
import { EXERCISE_DATABASE } from '@/lib/exercise-data';

// Build a lookup map: exercise name (lowercase) → category
const exerciseCategoryMap = new Map<string, string>();
for (const entry of EXERCISE_DATABASE) {
  exerciseCategoryMap.set(entry.name.toLowerCase(), entry.category);
}

/**
 * Look up the category for a single exercise name.
 * Falls back to partial matching if exact match isn't found.
 */
export function getExerciseCategory(name: string): string | null {
  const lower = name.toLowerCase();
  if (exerciseCategoryMap.has(lower)) return exerciseCategoryMap.get(lower)!;
  // Partial match fallback
  for (const [key, category] of exerciseCategoryMap) {
    if (lower.includes(key) || key.includes(lower)) return category;
  }
  return null;
}

/**
 * Given an array of exercises, return deduplicated category names.
 * Maintains a stable order based on first occurrence.
 */
export function getExerciseCategories(exercises: { name: string }[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const ex of exercises) {
    const cat = getExerciseCategory(ex.name);
    if (cat && !seen.has(cat)) {
      seen.add(cat);
      result.push(cat);
    }
  }
  return result;
}
