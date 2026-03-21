export const PLATES_LBS = [45, 35, 25, 10, 5, 2.5] as const;
export const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const;

export const BAR_WEIGHTS_LBS = [45, 35, 20] as const;
export const BAR_WEIGHTS_KG = [20, 15, 10] as const;

export type WeightUnit = 'lbs' | 'kg';

export interface PlateCount {
  weight: number;
  count: number;
}

export interface PlateBreakdown {
  plates: PlateCount[];
  remainder: number;
}

const BARBELL_KEYWORDS = [
  'bench',
  'squat',
  'deadlift',
  'overhead press',
  'ohp',
  'barbell',
];

const DUMBBELL_KEYWORDS = ['dumbbell', 'db '];

/** Returns true if the exercise name suggests a barbell movement. */
export function isBarbell(name: string): boolean {
  const lower = name.toLowerCase();
  if (DUMBBELL_KEYWORDS.some((kw) => lower.includes(kw))) return false;
  return BARBELL_KEYWORDS.some((kw) => lower.includes(kw));
}

/** Available plate sizes for the given unit. */
export function getPlates(unit: WeightUnit): readonly number[] {
  return unit === 'lbs' ? PLATES_LBS : PLATES_KG;
}

/** Available bar weights for the given unit. */
export function getBarWeights(unit: WeightUnit): readonly number[] {
  return unit === 'lbs' ? BAR_WEIGHTS_LBS : BAR_WEIGHTS_KG;
}

/** Default bar weight for a unit (first in the list). */
export function defaultBarWeight(unit: WeightUnit): number {
  return unit === 'lbs' ? 45 : 20;
}

/**
 * Given a total weight and bar weight, calculate which plates go on each side.
 * Uses a greedy algorithm - largest plates first.
 * Returns remainder > 0 if the weight can't be exactly achieved.
 */
export function calculatePlatesPerSide(
  totalWeight: number,
  barWeight: number,
  unit: WeightUnit,
): PlateBreakdown {
  const plates = getPlates(unit);
  let perSide = (totalWeight - barWeight) / 2;

  if (perSide <= 0) {
    return { plates: [], remainder: 0 };
  }

  const result: PlateCount[] = [];

  for (const plate of plates) {
    if (perSide >= plate) {
      const count = Math.floor(perSide / plate);
      result.push({ weight: plate, count });
      perSide -= count * plate;
      // Round to avoid floating-point drift
      perSide = Math.round(perSide * 100) / 100;
    }
  }

  return { plates: result, remainder: perSide };
}

/**
 * Given a map of plate counts per side and a bar weight, calculate the total.
 * plateCounts keys are plate weights, values are count per side.
 */
export function calculateTotalFromPlates(
  plateCounts: Record<number, number>,
  barWeight: number,
): number {
  let perSide = 0;
  for (const [weight, count] of Object.entries(plateCounts)) {
    perSide += Number(weight) * count;
  }
  return Math.round((barWeight + 2 * perSide) * 100) / 100;
}
