import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'exercise_increments';
const DELTAS_KEY = 'exercise_increment_deltas';

// Stored preferred increments: { "Bench Press": 5, "Cable Crossover": 15 }
type IncrementMap = Record<string, number>;

// Stored raw deltas per exercise from last N sessions:
// { "Bench Press": [[5,5,5],[10,5]], "Cable Crossover": [[15,15]] }
// Each sub-array = deltas from one session
type DeltaHistory = Record<string, number[][]>;

const MAX_SESSIONS = 5;

let cachedIncrements: IncrementMap | null = null;
let cachedDeltas: DeltaHistory | null = null;

/** Load the preferred increment map (cached after first read). */
export async function getIncrementMap(): Promise<IncrementMap> {
  if (cachedIncrements) return cachedIncrements;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cachedIncrements = raw ? JSON.parse(raw) : {};
  } catch {
    cachedIncrements = {};
  }
  return cachedIncrements!;
}

/** Get the preferred increment for an exercise (in display units). */
export async function getExerciseIncrement(
  exerciseName: string,
  weightUnit: 'lbs' | 'kg',
): Promise<number> {
  const map = await getIncrementMap();
  const key = exerciseName.toLowerCase();
  if (map[key] != null) return map[key];
  // Default: 5 lbs or 2.5 kg
  return weightUnit === 'lbs' ? 5 : 2.5;
}

/** Synchronous getter for use in components (requires preload). */
export function getExerciseIncrementSync(
  exerciseName: string,
  weightUnit: 'lbs' | 'kg',
): number {
  if (!cachedIncrements) return weightUnit === 'lbs' ? 5 : 2.5;
  const key = exerciseName.toLowerCase();
  if (cachedIncrements[key] != null) return cachedIncrements[key];
  return weightUnit === 'lbs' ? 5 : 2.5;
}

/** Preload cache - call on app start or workout screen mount. */
export async function preloadIncrements(): Promise<void> {
  await getIncrementMap();
  try {
    const raw = await AsyncStorage.getItem(DELTAS_KEY);
    cachedDeltas = raw ? JSON.parse(raw) : {};
  } catch {
    cachedDeltas = {};
  }
}

/**
 * After a workout is saved, compute deltas and update preferred increments.
 *
 * @param sessionDeltas - Map of exercise name -> array of weight deltas recorded
 *   during this session (from +/- button taps).
 */
export async function updateIncrementsAfterWorkout(
  sessionDeltas: Record<string, number[]>,
): Promise<void> {
  if (Object.keys(sessionDeltas).length === 0) return;

  // Load existing delta history
  let history: DeltaHistory;
  try {
    const raw = await AsyncStorage.getItem(DELTAS_KEY);
    history = raw ? JSON.parse(raw) : {};
  } catch {
    history = {};
  }

  // Append this session's deltas
  for (const [name, deltas] of Object.entries(sessionDeltas)) {
    if (deltas.length === 0) continue;
    const key = name.toLowerCase();
    if (!history[key]) history[key] = [];
    history[key].push(deltas);
    // Keep only last N sessions
    if (history[key].length > MAX_SESSIONS) {
      history[key] = history[key].slice(-MAX_SESSIONS);
    }
  }

  // Compute preferred increment per exercise using mode of all deltas
  const increments: IncrementMap = cachedIncrements ? { ...cachedIncrements } : {};

  for (const [key, sessions] of Object.entries(history)) {
    const allDeltas = sessions.flat();
    if (allDeltas.length === 0) continue;

    // Compute mode (most common delta value)
    const freq = new Map<number, number>();
    for (const d of allDeltas) {
      if (d > 0) freq.set(d, (freq.get(d) || 0) + 1);
    }
    if (freq.size === 0) continue;

    let mode = 0;
    let maxCount = 0;
    for (const [val, count] of freq) {
      if (count > maxCount || (count === maxCount && val > mode)) {
        mode = val;
        maxCount = count;
      }
    }
    if (mode > 0) {
      increments[key] = mode;
    }
  }

  // Persist
  cachedIncrements = increments;
  cachedDeltas = history;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(increments));
    await AsyncStorage.setItem(DELTAS_KEY, JSON.stringify(history));
  } catch {}
}

/**
 * Detect rapid tapping pattern.
 * If user taps + N times within `windowMs` and the total delta
 * suggests a larger increment, return the per-tap equivalent.
 *
 * E.g., 3 taps of +5 within 1.5s reaching +15 -> returns 15 as new increment.
 */
export function detectRapidTapIncrement(
  tapTimestamps: number[],
  currentIncrement: number,
  windowMs: number = 1500,
  minTaps: number = 3,
): number | null {
  if (tapTimestamps.length < minTaps) return null;

  // Check if the last `minTaps` taps happened within the window
  const recentTaps = tapTimestamps.slice(-minTaps);
  const elapsed = recentTaps[recentTaps.length - 1] - recentTaps[0];

  if (elapsed <= windowMs) {
    // User tapped minTaps times rapidly - they likely want a bigger increment
    return currentIncrement * minTaps;
  }

  return null;
}
