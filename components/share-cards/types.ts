import { BestSetResult } from '@/lib/workout-metrics';

export interface ShareCardData {
  dayName: string;
  focus: string;
  date: string;
  totalVolume: number;
  unitLabel: string;
  bestSet: BestSetResult | null;
  durationMinutes: number;
  totalSets: number;
  totalReps: number;
  musclesWorked: string[];
  density: number;
  avgIntensity: number;
  topE1RM: number | null;
  volumeComparison: string;
}

export interface CardVariant {
  id: 'magazine' | 'stamp';
  name: string;
}

export const CARD_VARIANTS: CardVariant[] = [
  { id: 'magazine', name: 'MAGAZINE CONDENSED' },
  { id: 'stamp', name: 'STAMP' },
];
