export interface WarmupMove {
  name: string;
  duration: string;
}

const WARMUP_MAP: Record<string, WarmupMove[]> = {
  chest: [
    { name: 'Band Pull-Aparts', duration: '15 reps' },
    { name: 'Arm Circles', duration: '30 sec each direction' },
    { name: 'Push-Ups (slow tempo)', duration: '10 reps' },
    { name: 'Chest Doorway Stretch', duration: '30 sec each side' },
    { name: 'Cat-Cow Stretch', duration: '30 sec' },
  ],
  back: [
    { name: 'Cat-Cow Stretch', duration: '30 sec' },
    { name: 'Band Pull-Aparts', duration: '15 reps' },
    { name: 'Dead Hangs', duration: '20 sec' },
    { name: 'Shoulder Circles', duration: '30 sec each direction' },
    { name: 'Thoracic Rotations', duration: '10 each side' },
  ],
  legs: [
    { name: 'Hip Circles', duration: '10 each direction' },
    { name: 'Bodyweight Squats', duration: '15 reps' },
    { name: 'Leg Swings', duration: '15 each leg' },
    { name: 'Pigeon Stretch', duration: '30 sec each side' },
    { name: 'Glute Bridges', duration: '15 reps' },
  ],
  shoulders: [
    { name: 'Arm Circles', duration: '30 sec each direction' },
    { name: 'Band Pull-Aparts', duration: '15 reps' },
    { name: 'Wall Slides', duration: '10 reps' },
    { name: 'Neck Rolls', duration: '30 sec each direction' },
    { name: 'Shoulder Dislocates', duration: '10 reps' },
  ],
  core: [
    { name: 'Dead Bugs', duration: '10 each side' },
    { name: 'Bird Dogs', duration: '10 each side' },
    { name: 'Hip Flexor Stretch', duration: '30 sec each side' },
    { name: 'Glute Bridges', duration: '15 reps' },
    { name: 'Cat-Cow Stretch', duration: '30 sec' },
  ],
  full: [
    { name: 'Jumping Jacks', duration: '60 sec' },
    { name: 'Inchworms', duration: '8 reps' },
    { name: "World's Greatest Stretch", duration: '5 each side' },
    { name: 'Hip Circles', duration: '10 each direction' },
    { name: 'Bodyweight Squats', duration: '15 reps' },
  ],
};

export function getWarmupForFocus(focus: string): WarmupMove[] {
  const lower = focus.toLowerCase();
  if (lower.includes('chest') || lower.includes('push') || lower.includes('tricep')) return WARMUP_MAP.chest;
  if (lower.includes('back') || lower.includes('pull') || lower.includes('bicep')) return WARMUP_MAP.back;
  if (lower.includes('leg') || lower.includes('lower') || lower.includes('squat') || lower.includes('glute') || lower.includes('hamstring') || lower.includes('quad')) return WARMUP_MAP.legs;
  if (lower.includes('shoulder') || lower.includes('delt')) return WARMUP_MAP.shoulders;
  if (lower.includes('core') || lower.includes('abs') || lower.includes('abdominal')) return WARMUP_MAP.core;
  return WARMUP_MAP.full;
}
