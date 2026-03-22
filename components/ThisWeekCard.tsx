import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSettings } from '@/lib/settings-context';
import { formatNumber } from '@/lib/utils';

export interface WeekDayData {
  day: string;
  volume: number;
  isWorkout: boolean;
  isFuture: boolean;
  isRestDay?: boolean;
}

interface ThisWeekCardProps {
  weekData: WeekDayData[];
  totalVolume: number;
  sessionsCount: number;
  prCount: number;
}

const DAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const BAR_MAX_HEIGHT = 100;
const BAR_MIN_HEIGHT = 6;

export default function ThisWeekCard({
  weekData,
  totalVolume,
  sessionsCount,
  prCount,
}: ThisWeekCardProps) {
  const { theme, weightUnit } = useSettings();

  const maxVolume = Math.max(...weekData.map((d) => d.volume), 1);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
      ]}
    >
      {/* Header */}
      <Text style={[styles.label, { color: theme.textSecondary }]}>
        This week
      </Text>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statBlock}>
          <Text style={[styles.statValueLarge, { color: theme.text }]}>
            {formatNumber(totalVolume)}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            {weightUnit === 'lbs' ? 'lbs' : 'kg'} moved
          </Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={[styles.statValue, { color: theme.text }]}>
            {sessionsCount}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            sessions
          </Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={[styles.statValue, { color: theme.text }]}>
            {prCount}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            PRs
          </Text>
        </View>
      </View>

      {/* Bar chart with Y-axis */}
      <View style={{ flexDirection: 'row' }}>
        {/* Y-axis */}
        <View style={{ width: 36, height: BAR_MAX_HEIGHT, justifyContent: 'space-between', paddingRight: 4 }}>
          {[...Array(3)].map((_, i) => {
            const scaleMax = Math.ceil(maxVolume / 5000) * 5000 || 5000;
            const tick = Math.round(scaleMax - (scaleMax / 2) * i);
            return (
              <Text key={i} style={{ fontSize: 8, color: theme.textSecondary, textAlign: 'right' }}>
                {tick >= 1000 ? `${Math.round(tick / 1000)}k` : tick}
              </Text>
            );
          })}
        </View>
        <View style={[styles.chartRow, { flex: 1 }]}>
        {weekData.map((day, i) => {
          const isHighest =
            day.isWorkout && !day.isFuture && day.volume === maxVolume && day.volume > 0;
          const barHeight =
            day.isFuture || !day.isWorkout || day.volume === 0
              ? BAR_MIN_HEIGHT
              : Math.max(
                  BAR_MIN_HEIGHT,
                  Math.round((day.volume / maxVolume) * BAR_MAX_HEIGHT)
                );

          let barStyle;
          if (day.isFuture) {
            // Future: dimmed empty bar
            barStyle = {
              backgroundColor: 'transparent',
              borderWidth: 1,
              borderColor: theme.border,
              opacity: 0.3,
            };
          } else if (!day.isWorkout || day.volume === 0) {
            // Rest day or no volume: subtle bordered bar
            barStyle = {
              backgroundColor: 'transparent',
              borderWidth: 1,
              borderColor: theme.border,
            };
          } else if (isHighest) {
            // Highest volume day: bright highlight
            barStyle = {
              backgroundColor: theme.text,
            };
          } else {
            // Normal workout day: surface with border
            barStyle = {
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.border,
            };
          }

          return (
            <View key={i} style={styles.barColumn}>
              <View style={styles.barContainer}>
                {day.isRestDay && !day.isFuture && !day.isWorkout ? (
                  <View style={{ alignItems: 'center', justifyContent: 'flex-end', height: 40 }}>
                    <Text style={{ fontSize: 8, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1.5, transform: [{ rotate: '-90deg' }] }}>REST</Text>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.bar,
                      {
                        height: barHeight,
                      },
                      barStyle,
                    ]}
                  />
                )}
              </View>
              <Text
                style={[
                  styles.dayInitial,
                  {
                    color: day.isFuture
                      ? theme.textSecondary
                      : theme.text,
                    opacity: day.isFuture ? 0.3 : 0.6,
                  },
                ]}
              >
                {DAY_INITIALS[i]}
              </Text>
            </View>
          );
        })}
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
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 20,
    marginBottom: 20,
  },
  statBlock: {
    alignItems: 'flex-start',
  },
  statValueLarge: {
    fontSize: 20,
    fontWeight: '700',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  chartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
  },
  barContainer: {
    height: BAR_MAX_HEIGHT,
    justifyContent: 'flex-end',
    width: '100%',
    alignItems: 'center',
  },
  bar: {
    width: '60%',
    minWidth: 12,
    maxWidth: 28,
    borderRadius: 4,
  },
  dayInitial: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 6,
  },
});
