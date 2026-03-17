export interface WarmupMove {
  name: string;
  duration: string;
}

export interface WarmupRoutine {
  cardio: WarmupMove[];
  mobility: WarmupMove[];
}

const CARDIO: WarmupMove[] = [
  { name: 'Treadmill Brisk Walk', duration: '5 min' },
];

const MOBILITY_MAP: Record<string, WarmupMove[]> = {
  chest: [
    { name: 'Arm Circles', duration: '30 sec each direction' },
    { name: 'Band Pull-Aparts', duration: '15 reps' },
    { name: 'Chest Doorway Stretch', duration: '30 sec each side' },
    { name: 'Shoulder Pass-Throughs', duration: '10 reps' },
    { name: 'Thoracic Spine Rotations', duration: '10 each side' },
  ],
  back: [
    { name: 'Arm Circles', duration: '30 sec each direction' },
    { name: 'Cat-Cow Stretch', duration: '30 sec' },
    { name: 'Thoracic Spine Rotations', duration: '10 each side' },
    { name: 'Band Pull-Aparts', duration: '15 reps' },
    { name: 'Dead Hangs', duration: '20 sec' },
  ],
  legs: [
    { name: 'Leg Swings (front-back)', duration: '15 each leg' },
    { name: 'Leg Swings (side-side)', duration: '15 each leg' },
    { name: 'Hip Circles', duration: '10 each direction' },
    { name: 'Bodyweight Squats', duration: '15 reps' },
    { name: 'Ankle Circles', duration: '10 each direction' },
  ],
  shoulders: [
    { name: 'Arm Circles', duration: '30 sec each direction' },
    { name: 'Shoulder Pass-Throughs', duration: '10 reps' },
    { name: 'Wall Slides', duration: '10 reps' },
    { name: 'Neck Rolls', duration: '30 sec each direction' },
    { name: 'Torso Twists', duration: '20 reps' },
  ],
  core: [
    { name: 'Torso Twists', duration: '20 reps' },
    { name: 'Hip Circles', duration: '10 each direction' },
    { name: 'Cat-Cow Stretch', duration: '30 sec' },
    { name: 'Dead Bugs (slow)', duration: '10 each side' },
    { name: 'Hip Flexor Stretch', duration: '30 sec each side' },
  ],
  full: [
    { name: 'Arm Circles', duration: '30 sec each direction' },
    { name: 'Leg Swings', duration: '15 each leg' },
    { name: 'Hip Circles', duration: '10 each direction' },
    { name: 'Torso Twists', duration: '20 reps' },
    { name: "World's Greatest Stretch", duration: '5 each side' },
  ],
};

function getMobilityForFocus(focus: string): WarmupMove[] {
  const lower = focus.toLowerCase();
  if (lower.includes('chest') || lower.includes('push') || lower.includes('tricep')) return MOBILITY_MAP.chest;
  if (lower.includes('back') || lower.includes('pull') || lower.includes('bicep')) return MOBILITY_MAP.back;
  if (lower.includes('leg') || lower.includes('lower') || lower.includes('squat') || lower.includes('glute') || lower.includes('hamstring') || lower.includes('quad')) return MOBILITY_MAP.legs;
  if (lower.includes('shoulder') || lower.includes('delt')) return MOBILITY_MAP.shoulders;
  if (lower.includes('core') || lower.includes('abs') || lower.includes('abdominal')) return MOBILITY_MAP.core;
  return MOBILITY_MAP.full;
}

/** @deprecated Use getWarmupRoutine instead */
export function getWarmupForFocus(focus: string): WarmupMove[] {
  return [...CARDIO, ...getMobilityForFocus(focus)];
}

export function getWarmupRoutine(focus: string): WarmupRoutine {
  return {
    cardio: CARDIO,
    mobility: getMobilityForFocus(focus),
  };
}
