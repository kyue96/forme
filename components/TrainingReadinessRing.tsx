import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useSettings } from '@/lib/settings-context';
import { getExerciseCategory } from '@/lib/exercise-utils';
import type { LoggedExercise } from '@/lib/types';
import { isUnilateralExercise } from '@/lib/workout-metrics';

interface RecentLog {
  exercises: LoggedExercise[];
  completed_at: string;
}

interface TrainingReadinessRingProps {
  recentLogs: RecentLog[];
}

const RING_SIZE = 52;
const STROKE_WIDTH = 5;
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
        const mul = isUnilateralExercise(exercise.name) ? 2 : 1;
        for (const set of exercise.sets) {
          if (set.completed && set.weight != null) {
            volume += set.weight * set.reps * mul;
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
    if (recovering.length === 0) return `${ready.join(', ')} ready`;
    if (ready.length === 0) return `${recovering.join(', ')} recovering`;
    return `${recovering.join(', ')} recovering`;
  }, [recovering, ready]);

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {/* Ring */}
      <View style={styles.ringContainer}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke={theme.border}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
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
        <View style={styles.scoreOverlay} pointerEvents="none">
          <Text style={[styles.scoreNumber, { color: theme.text }]}>{score}</Text>
        </View>
      </View>

      {/* Text */}
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>Training Readiness</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  ringContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: {
    fontSize: 16,
    fontWeight: '700',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
  },
});
