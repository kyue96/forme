import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useSettings } from '@/lib/settings-context';
import { getExerciseCategory } from '@/lib/exercise-utils';
import type { LoggedExercise } from '@/lib/types';

interface RecentLog {
  exercises: LoggedExercise[];
  completed_at: string;
}

interface TrainingReadinessRingProps {
  recentLogs: RecentLog[];
}

const RING_SIZE = 100;
const STROKE_WIDTH = 8;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SCALE_FACTOR = 5000;

export default function TrainingReadinessRing({ recentLogs }: TrainingReadinessRingProps) {
  const { theme } = useSettings();

  const { score, recovering, ready } = useMemo(() => {
    if (!recentLogs || recentLogs.length === 0) {
      return { score: 100, recovering: [] as string[], ready: [] as string[] };
    }

    const now = Date.now();
    const fatigueByMuscle: Record<string, number> = {};

    for (const log of recentLogs) {
      const hoursElapsed = (now - new Date(log.completed_at).getTime()) / (1000 * 60 * 60);
      const decayFactor = Math.max(0, 1 - hoursElapsed / 72);
      if (decayFactor === 0) continue;

      const volumeByMuscle: Record<string, number> = {};

      for (const exercise of log.exercises) {
        const category = getExerciseCategory(exercise.name);
        if (!category) continue;

        let volume = 0;
        for (const set of exercise.sets) {
          if (set.completed && set.weight != null) {
            volume += set.weight * set.reps;
          }
        }

        volumeByMuscle[category] = (volumeByMuscle[category] || 0) + volume;
      }

      for (const [muscle, volume] of Object.entries(volumeByMuscle)) {
        fatigueByMuscle[muscle] = (fatigueByMuscle[muscle] || 0) + volume * decayFactor;
      }
    }

    const muscles = Object.keys(fatigueByMuscle);
    if (muscles.length === 0) {
      return { score: 100, recovering: [] as string[], ready: [] as string[] };
    }

    const totalFatigue = Object.values(fatigueByMuscle).reduce((sum, v) => sum + v, 0);
    const computedScore = Math.round(100 - Math.min(100, totalFatigue / SCALE_FACTOR));

    const maxFatigue = Math.max(...Object.values(fatigueByMuscle));
    const threshold = maxFatigue * 0.3;

    const recoveringMuscles: string[] = [];
    const readyMuscles: string[] = [];

    for (const muscle of muscles) {
      if (fatigueByMuscle[muscle] > threshold) {
        recoveringMuscles.push(muscle);
      } else {
        readyMuscles.push(muscle);
      }
    }

    return {
      score: computedScore,
      recovering: recoveringMuscles,
      ready: readyMuscles,
    };
  }, [recentLogs]);

  const strokeDashoffset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE;

  const subtitle = useMemo(() => {
    if (recovering.length === 0 && ready.length === 0) return 'No recent sessions logged';
    if (recovering.length === 0) return `${ready.join(', ')} ready to train`;
    if (ready.length === 0) return `${recovering.join(', ')} recovering`;
    return `${recovering.join(', ')} recovering \u2022 ${ready.join(', ')} ready`;
  }, [recovering, ready]);

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.row}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          {/* Track */}
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke={theme.border}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          {/* Filled arc */}
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke={theme.text}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeDasharray={`${CIRCUMFERENCE}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation={-90}
            origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
          />
        </Svg>

        {/* Score label centered over ring */}
        <View style={styles.scoreOverlay} pointerEvents="none">
          <Text style={[styles.scoreNumber, { color: theme.text }]}>{score}</Text>
          <Text style={[styles.scorePercent, { color: theme.textSecondary }]}>%</Text>
        </View>
      </View>

      <Text style={[styles.title, { color: theme.text }]}>Training readiness</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
        {subtitle}
      </Text>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDotFilled, { backgroundColor: theme.text }]} />
          <Text style={[styles.legendLabel, { color: theme.textSecondary }]}>Recovering</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDotOutline, { borderColor: theme.text }]} />
          <Text style={[styles.legendLabel, { color: theme.textSecondary }]}>Ready</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  row: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  scoreOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  scoreNumber: {
    fontSize: 28,
    fontWeight: '700',
  },
  scorePercent: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
    marginLeft: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDotFilled: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendDotOutline: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  legendLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
});
