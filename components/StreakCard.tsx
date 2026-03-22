import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '@/lib/settings-context';

interface PastDay {
  isWorkout: boolean;
  isActive: boolean;
}

interface StreakCardProps {
  streak: number;
  pastDays: PastDay[]; // 7 items, index 6 = today
}

export default function StreakCard({ streak, pastDays }: StreakCardProps) {
  const { theme } = useSettings();

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
      {/* Left: flame icon */}
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: theme.border },
        ]}
      >
        <Ionicons name="flame" size={20} color="#F59E0B" />
      </View>

      {/* Middle: streak text */}
      <View style={styles.textContainer}>
        <Text style={[styles.streakText, { color: theme.text }]}>
          {streak}-day streak
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Keep the chain going
        </Text>
      </View>

      {/* Right: 7 dots */}
      <View style={styles.dotsContainer}>
        {pastDays.map((day, index) => {
          const isToday = index === 6;

          if (isToday) {
            return (
              <View
                key={index}
                style={[
                  styles.dot,
                  styles.todayDot,
                  { borderColor: theme.text },
                ]}
              />
            );
          }

          if (day.isWorkout) {
            return (
              <View
                key={index}
                style={[styles.dot, { backgroundColor: theme.text }]}
              />
            );
          }

          if (day.isActive) {
            return (
              <View
                key={index}
                style={[styles.dot, { backgroundColor: theme.chrome }]}
              />
            );
          }

          return (
            <View
              key={index}
              style={[styles.dot, { backgroundColor: theme.border }]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
  },
  streakText: {
    fontSize: 15,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  todayDot: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
});
