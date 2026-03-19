import { PoseAngles, STANDING } from '@/components/PoseMannequin';

/**
 * Start and end poses for exercises.
 * Each exercise maps to a [start, end] tuple of joint angles.
 * Exercises not listed here will use the STANDING default.
 */

// ── Reusable pose fragments ──

const ARMS_OVERHEAD: Partial<PoseAngles> = { leftShoulder: -160, leftElbow: 10, rightShoulder: 160, rightElbow: -10 };
const ARMS_FRONT_HOLD: Partial<PoseAngles> = { leftShoulder: -70, leftElbow: -20, rightShoulder: 70, rightElbow: 20 };
const SQUAT_BOTTOM: Partial<PoseAngles> = { leftHip: -40, leftKnee: -80, rightHip: 40, rightKnee: 80, torsoLean: 15 };
const LUNGE_BOTTOM: Partial<PoseAngles> = { leftHip: -30, leftKnee: -70, rightHip: 50, rightKnee: 70, torsoLean: 5 };

function pose(overrides: Partial<PoseAngles>): PoseAngles {
  return { ...STANDING, ...overrides };
}

type PosePair = [PoseAngles, PoseAngles];

export const EXERCISE_POSES: Record<string, PosePair> = {
  // ── CHEST ──
  'barbell bench press': [
    pose({ leftShoulder: -90, leftElbow: -90, rightShoulder: 90, rightElbow: 90, torsoLean: 0 }),
    pose({ leftShoulder: -90, leftElbow: 0, rightShoulder: 90, rightElbow: 0, torsoLean: 0 }),
  ],
  'dumbbell bench press': [
    pose({ leftShoulder: -90, leftElbow: -90, rightShoulder: 90, rightElbow: 90 }),
    pose({ leftShoulder: -90, leftElbow: 0, rightShoulder: 90, rightElbow: 0 }),
  ],
  'push-up': [
    pose({ leftShoulder: -70, leftElbow: -90, rightShoulder: 70, rightElbow: 90, leftHip: -5, rightHip: 5, torsoLean: 70 }),
    pose({ leftShoulder: -70, leftElbow: -10, rightShoulder: 70, rightElbow: 10, leftHip: -5, rightHip: 5, torsoLean: 70 }),
  ],
  'dumbbell chest fly': [
    pose({ leftShoulder: -120, leftElbow: -20, rightShoulder: 120, rightElbow: 20 }),
    pose({ leftShoulder: -80, leftElbow: -10, rightShoulder: 80, rightElbow: 10 }),
  ],
  'cable crossover': [
    pose({ leftShoulder: -130, leftElbow: -15, rightShoulder: 130, rightElbow: 15 }),
    pose({ leftShoulder: -30, leftElbow: -10, rightShoulder: 30, rightElbow: 10, torsoLean: 10 }),
  ],
  'incline bench press': [
    pose({ leftShoulder: -110, leftElbow: -90, rightShoulder: 110, rightElbow: 90, torsoLean: -20 }),
    pose({ leftShoulder: -110, leftElbow: 0, rightShoulder: 110, rightElbow: 0, torsoLean: -20 }),
  ],
  'chest dip': [
    pose({ leftShoulder: -20, leftElbow: 0, rightShoulder: 20, rightElbow: 0, leftHip: 15, rightHip: -15, leftKnee: -40, rightKnee: 40 }),
    pose({ leftShoulder: -40, leftElbow: -90, rightShoulder: 40, rightElbow: 90, leftHip: 15, rightHip: -15, leftKnee: -40, rightKnee: 40 }),
  ],

  // ── BACK ──
  'pull-up': [
    pose({ leftShoulder: -160, leftElbow: 0, rightShoulder: 160, rightElbow: 0, leftHip: 5, rightHip: -5, leftKnee: -20, rightKnee: 20 }),
    pose({ leftShoulder: -100, leftElbow: -80, rightShoulder: 100, rightElbow: 80, leftHip: 5, rightHip: -5, leftKnee: -20, rightKnee: 20 }),
  ],
  'chin-up': [
    pose({ leftShoulder: -160, leftElbow: 0, rightShoulder: 160, rightElbow: 0, leftKnee: -20, rightKnee: 20 }),
    pose({ leftShoulder: -100, leftElbow: -80, rightShoulder: 100, rightElbow: 80, leftKnee: -20, rightKnee: 20 }),
  ],
  'lat pulldown': [
    pose({ ...ARMS_OVERHEAD }),
    pose({ leftShoulder: -100, leftElbow: -90, rightShoulder: 100, rightElbow: 90 }),
  ],
  'barbell row': [
    pose({ leftShoulder: -10, leftElbow: 0, rightShoulder: 10, rightElbow: 0, torsoLean: 45, leftHip: -20, rightHip: 20, leftKnee: -15, rightKnee: 15 }),
    pose({ leftShoulder: -50, leftElbow: -100, rightShoulder: 50, rightElbow: 100, torsoLean: 45, leftHip: -20, rightHip: 20, leftKnee: -15, rightKnee: 15 }),
  ],
  'dumbbell row': [
    pose({ leftShoulder: -10, leftElbow: 0, rightShoulder: 10, rightElbow: 0, torsoLean: 45, leftHip: -20, rightHip: 20 }),
    pose({ leftShoulder: -50, leftElbow: -100, rightShoulder: 50, rightElbow: 100, torsoLean: 45, leftHip: -20, rightHip: 20 }),
  ],
  'deadlift': [
    pose({ torsoLean: 50, leftHip: -30, leftKnee: -40, rightHip: 30, rightKnee: 40, leftShoulder: -10, rightShoulder: 10 }),
    pose({ torsoLean: 0, leftHip: -5, leftKnee: 0, rightHip: 5, rightKnee: 0, leftShoulder: -15, rightShoulder: 15 }),
  ],
  'seated cable row': [
    pose({ leftShoulder: -70, leftElbow: 0, rightShoulder: 70, rightElbow: 0, torsoLean: 5, leftHip: -70, rightHip: 70, leftKnee: -10, rightKnee: 10 }),
    pose({ leftShoulder: -40, leftElbow: -100, rightShoulder: 40, rightElbow: 100, torsoLean: -5, leftHip: -70, rightHip: 70, leftKnee: -10, rightKnee: 10 }),
  ],

  // ── SHOULDERS ──
  'overhead press': [
    pose({ leftShoulder: -130, leftElbow: -90, rightShoulder: 130, rightElbow: 90 }),
    pose({ ...ARMS_OVERHEAD }),
  ],
  'dumbbell shoulder press': [
    pose({ leftShoulder: -130, leftElbow: -90, rightShoulder: 130, rightElbow: 90 }),
    pose({ ...ARMS_OVERHEAD }),
  ],
  'dumbbell lateral raise': [
    pose({ leftShoulder: -15, leftElbow: -10, rightShoulder: 15, rightElbow: 10 }),
    pose({ leftShoulder: -110, leftElbow: -10, rightShoulder: 110, rightElbow: 10 }),
  ],
  'face pull': [
    pose({ leftShoulder: -70, leftElbow: 0, rightShoulder: 70, rightElbow: 0 }),
    pose({ leftShoulder: -110, leftElbow: -120, rightShoulder: 110, rightElbow: 120 }),
  ],
  'arnold press': [
    pose({ leftShoulder: -70, leftElbow: -120, rightShoulder: 70, rightElbow: 120 }),
    pose({ ...ARMS_OVERHEAD }),
  ],
  'dumbbell shrug': [
    pose({ leftShoulder: -15, leftElbow: 0, rightShoulder: 15, rightElbow: 0 }),
    pose({ leftShoulder: -15, leftElbow: 0, rightShoulder: 15, rightElbow: 0 }),
  ],

  // ── BICEPS ──
  'barbell curl': [
    pose({ leftShoulder: -15, leftElbow: 0, rightShoulder: 15, rightElbow: 0 }),
    pose({ leftShoulder: -15, leftElbow: -140, rightShoulder: 15, rightElbow: 140 }),
  ],
  'dumbbell curl': [
    pose({ leftShoulder: -15, leftElbow: 0, rightShoulder: 15, rightElbow: 0 }),
    pose({ leftShoulder: -15, leftElbow: -140, rightShoulder: 15, rightElbow: 140 }),
  ],
  'hammer curl': [
    pose({ leftShoulder: -15, leftElbow: 0, rightShoulder: 15, rightElbow: 0 }),
    pose({ leftShoulder: -15, leftElbow: -130, rightShoulder: 15, rightElbow: 130 }),
  ],
  'preacher curl': [
    pose({ leftShoulder: -60, leftElbow: 0, rightShoulder: 60, rightElbow: 0, torsoLean: 15 }),
    pose({ leftShoulder: -60, leftElbow: -130, rightShoulder: 60, rightElbow: 130, torsoLean: 15 }),
  ],
  'concentration curl': [
    pose({ leftShoulder: -30, leftElbow: 0, rightShoulder: 50, rightElbow: 0, torsoLean: 30, leftHip: -50, rightHip: 50, leftKnee: -60, rightKnee: 60 }),
    pose({ leftShoulder: -30, leftElbow: -130, rightShoulder: 50, rightElbow: 0, torsoLean: 30, leftHip: -50, rightHip: 50, leftKnee: -60, rightKnee: 60 }),
  ],

  // ── TRICEPS ──
  'tricep pushdown': [
    pose({ leftShoulder: -15, leftElbow: -90, rightShoulder: 15, rightElbow: 90 }),
    pose({ leftShoulder: -15, leftElbow: 0, rightShoulder: 15, rightElbow: 0 }),
  ],
  'skull crusher': [
    pose({ leftShoulder: -130, leftElbow: -120, rightShoulder: 130, rightElbow: 120 }),
    pose({ leftShoulder: -130, leftElbow: 0, rightShoulder: 130, rightElbow: 0 }),
  ],
  'tricep dip': [
    pose({ leftShoulder: -20, leftElbow: 0, rightShoulder: 20, rightElbow: 0, leftKnee: -40, rightKnee: 40 }),
    pose({ leftShoulder: -40, leftElbow: -90, rightShoulder: 40, rightElbow: 90, leftKnee: -40, rightKnee: 40 }),
  ],
  'dumbbell overhead tricep extension': [
    pose({ leftShoulder: -160, leftElbow: -130, rightShoulder: 160, rightElbow: 130 }),
    pose({ ...ARMS_OVERHEAD }),
  ],

  // ── LEGS ──
  'squat': [
    pose({ leftShoulder: -70, leftElbow: -20, rightShoulder: 70, rightElbow: 20 }),
    pose({ ...ARMS_FRONT_HOLD, ...SQUAT_BOTTOM }),
  ],
  'barbell squat': [
    pose({ leftShoulder: -130, leftElbow: -60, rightShoulder: 130, rightElbow: 60 }),
    pose({ leftShoulder: -130, leftElbow: -60, rightShoulder: 130, rightElbow: 60, ...SQUAT_BOTTOM }),
  ],
  'front squat': [
    pose({ ...ARMS_FRONT_HOLD }),
    pose({ ...ARMS_FRONT_HOLD, ...SQUAT_BOTTOM }),
  ],
  'leg press': [
    pose({ leftHip: -60, leftKnee: -80, rightHip: 60, rightKnee: 80, torsoLean: -30 }),
    pose({ leftHip: -60, leftKnee: -10, rightHip: 60, rightKnee: 10, torsoLean: -30 }),
  ],
  'lunge': [
    pose({}),
    pose({ ...LUNGE_BOTTOM }),
  ],
  'walking lunge': [
    pose({}),
    pose({ ...LUNGE_BOTTOM }),
  ],
  'bulgarian split squat': [
    pose({ leftHip: -5, rightHip: 30, rightKnee: 60 }),
    pose({ leftHip: -30, leftKnee: -70, rightHip: 50, rightKnee: 90, torsoLean: 5 }),
  ],
  'leg extension': [
    pose({ leftHip: -70, leftKnee: -80, rightHip: 70, rightKnee: 80, torsoLean: -20 }),
    pose({ leftHip: -70, leftKnee: 0, rightHip: 70, rightKnee: 0, torsoLean: -20 }),
  ],
  'leg curl': [
    pose({ torsoLean: 80, leftHip: -5, leftKnee: 0, rightHip: 5, rightKnee: 0 }),
    pose({ torsoLean: 80, leftHip: -5, leftKnee: -110, rightHip: 5, rightKnee: 110 }),
  ],
  'hip thrust': [
    pose({ torsoLean: -30, leftHip: -50, leftKnee: -80, rightHip: 50, rightKnee: 80 }),
    pose({ torsoLean: -50, leftHip: -20, leftKnee: -60, rightHip: 20, rightKnee: 60 }),
  ],
  'calf raise': [
    pose({}),
    pose({ leftHip: -5, rightHip: 5 }),
  ],
  'romanian deadlift': [
    pose({ leftShoulder: -15, rightShoulder: 15 }),
    pose({ torsoLean: 50, leftHip: -20, rightHip: 20, leftShoulder: -10, rightShoulder: 10, leftKnee: -10, rightKnee: 10 }),
  ],
  'goblet squat': [
    pose({ ...ARMS_FRONT_HOLD }),
    pose({ ...ARMS_FRONT_HOLD, ...SQUAT_BOTTOM }),
  ],
  'hack squat': [
    pose({ torsoLean: -20 }),
    pose({ torsoLean: -20, ...SQUAT_BOTTOM }),
  ],

  // ── CORE ──
  'plank': [
    pose({ torsoLean: 75, leftShoulder: -70, leftElbow: -90, rightShoulder: 70, rightElbow: 90, leftHip: -5, rightHip: 5 }),
    pose({ torsoLean: 75, leftShoulder: -70, leftElbow: -90, rightShoulder: 70, rightElbow: 90, leftHip: -5, rightHip: 5 }),
  ],
  'crunch': [
    pose({ torsoLean: 80, leftShoulder: -120, leftElbow: -60, rightShoulder: 120, rightElbow: 60, leftHip: -40, leftKnee: -80, rightHip: 40, rightKnee: 80 }),
    pose({ torsoLean: 50, leftShoulder: -120, leftElbow: -60, rightShoulder: 120, rightElbow: 60, leftHip: -40, leftKnee: -80, rightHip: 40, rightKnee: 80 }),
  ],
  'hanging leg raise': [
    pose({ ...ARMS_OVERHEAD, leftHip: -5, rightHip: 5 }),
    pose({ ...ARMS_OVERHEAD, leftHip: -70, leftKnee: 0, rightHip: 70, rightKnee: 0 }),
  ],
  'russian twist': [
    pose({ torsoLean: -30, leftShoulder: -70, leftElbow: -30, rightShoulder: 70, rightElbow: 30, leftHip: -40, leftKnee: -50, rightHip: 40, rightKnee: 50 }),
    pose({ torsoLean: -30, leftShoulder: -70, leftElbow: -30, rightShoulder: 70, rightElbow: 30, leftHip: -40, leftKnee: -50, rightHip: 40, rightKnee: 50 }),
  ],
  'mountain climber': [
    pose({ torsoLean: 70, leftShoulder: -70, leftElbow: -10, rightShoulder: 70, rightElbow: 10, leftHip: -60, leftKnee: -80, rightHip: 10, rightKnee: 0 }),
    pose({ torsoLean: 70, leftShoulder: -70, leftElbow: -10, rightShoulder: 70, rightElbow: 10, leftHip: 10, leftKnee: 0, rightHip: -60, rightKnee: -80 }),
  ],

  // ── CARDIO ──
  'kettlebell swing': [
    pose({ torsoLean: 40, leftShoulder: -10, leftElbow: 0, rightShoulder: 10, rightElbow: 0, leftHip: -20, leftKnee: -30, rightHip: 20, rightKnee: 30 }),
    pose({ torsoLean: -5, ...ARMS_FRONT_HOLD, leftHip: -5, rightHip: 5 }),
  ],
  'burpee': [
    pose({}),
    pose({ torsoLean: 75, leftShoulder: -70, leftElbow: -90, rightShoulder: 70, rightElbow: 90, leftHip: -5, rightHip: 5 }),
  ],
  'box jump': [
    pose({ ...SQUAT_BOTTOM, leftShoulder: -10, rightShoulder: 10 }),
    pose({ ...ARMS_OVERHEAD }),
  ],
  'jump rope': [
    pose({ leftShoulder: -40, leftElbow: -90, rightShoulder: 40, rightElbow: 90 }),
    pose({ leftShoulder: -40, leftElbow: -90, rightShoulder: 40, rightElbow: 90, leftHip: -5, rightHip: 5 }),
  ],
};

/**
 * Get the start and end poses for an exercise.
 * Falls back to standing pose if not defined.
 */
export function getExercisePoses(name: string): PosePair {
  const lower = name.toLowerCase().trim();

  // Exact match
  if (EXERCISE_POSES[lower]) return EXERCISE_POSES[lower];

  // Strip trailing 's'
  if (lower.endsWith('s') && !lower.endsWith('ss')) {
    const singular = lower.slice(0, -1);
    if (EXERCISE_POSES[singular]) return EXERCISE_POSES[singular];
  }

  // Partial match
  for (const key of Object.keys(EXERCISE_POSES)) {
    if (lower.includes(key) || key.includes(lower)) return EXERCISE_POSES[key];
  }

  return [STANDING, STANDING];
}
