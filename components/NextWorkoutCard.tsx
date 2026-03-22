import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSettings } from '@/lib/settings-context';

interface Exercise {
  name: string;
  sets: number;
  reps: string;
}

interface NextWorkoutCardProps {
  workoutName: string;
  programTag?: string;
  dateLabel: string;
  exercises: Exercise[];
  color?: string;
}

const MAX_VISIBLE = 3;

export default function NextWorkoutCard({
  workoutName,
  programTag,
  dateLabel,
  exercises,
  color,
}: NextWorkoutCardProps) {
  const { theme } = useSettings();
  const visible = exercises.slice(0, MAX_VISIBLE);
  const remaining = exercises.length - MAX_VISIBLE;
  const backgroundColor = color ?? theme.surface;
  const borderColor = color ?? theme.border;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: backgroundColor,
          borderColor: borderColor,
        },
      ]}
    >
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text
          style={[styles.workoutName, { color: theme.text }]}
          numberOfLines={1}
        >
          {workoutName}
        </Text>
        {programTag ? (
          <View
            style={[
              styles.tagPill,
              { backgroundColor: theme.border },
            ]}
          >
            <Text style={[styles.tagText, { color: theme.textSecondary }]}>
              {programTag}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Date label */}
      <Text style={[styles.dateLabel, { color: theme.textSecondary }]}>
        Up next — {dateLabel}
      </Text>

      {/* Exercise rows */}
      <View style={styles.exerciseList}>
        {visible.map((ex, i) => {
          const isLast = i === visible.length - 1 && remaining <= 0;
          return (
            <View
              key={i}
              style={[
                styles.exerciseRow,
                !isLast && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.exerciseIndex, { color: theme.textSecondary }]}>
                {i + 1}
              </Text>
              <Text
                style={[styles.exerciseName, { color: theme.text }]}
                numberOfLines={1}
              >
                {ex.name}
              </Text>
              <Text style={[styles.exerciseMeta, { color: theme.textSecondary }]}>
                {ex.sets} x {ex.reps}
              </Text>
            </View>
          );
        })}
      </View>

      {/* More exercises */}
      {remaining > 0 && (
        <Text style={[styles.moreText, { color: theme.textSecondary }]}>
          +{remaining} more exercise{remaining !== 1 ? 's' : ''}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  workoutName: {
    fontSize: 17,
    fontWeight: '700',
    flexShrink: 1,
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    marginBottom: 12,
  },
  exerciseList: {
    gap: 0,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  exerciseIndex: {
    fontSize: 13,
    fontWeight: '600',
    width: 18,
    textAlign: 'center',
  },
  exerciseName: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  exerciseMeta: {
    fontSize: 13,
    fontWeight: '500',
  },
  moreText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 6,
    paddingLeft: 26,
  },
});
