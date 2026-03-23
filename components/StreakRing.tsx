import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useSettings } from '@/lib/settings-context';

const MILESTONES = [7, 14, 21, 30, 45, 60, 90, 120, 180, 365];

function getNextMilestone(streak: number): number {
  return MILESTONES.find((m) => m > streak) ?? streak + 30;
}

interface StreakRingProps {
  streak: number;
  maxStreak?: number;
  size?: 'large' | 'compact' | 'mini';
  color?: string;
}

export function StreakRing({ streak, maxStreak = 0, size = 'large', color }: StreakRingProps) {
  const { theme } = useSettings();
  const accentColor = color || '#F59E0B';

  const goal = getNextMilestone(streak);
  const progress = Math.min(streak / goal, 1);
  const isNearBest = maxStreak > 0 && streak >= maxStreak - 3 && streak <= maxStreak;
  const isNewBest = streak > maxStreak && maxStreak > 0;
  const remaining = goal - streak;

  if (size === 'compact') {
    const ringSize = 52;
    const strokeWidth = 5;
    const radius = (ringSize - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - progress);

    return (
      <View style={{
        backgroundColor: theme.surface,
        borderRadius: 16,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: theme.border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}>
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={ringSize} height={ringSize}>
            <Circle cx={ringSize / 2} cy={ringSize / 2} r={radius} stroke={theme.border} strokeWidth={strokeWidth} fill="none" rotation={-90} origin={`${ringSize / 2}, ${ringSize / 2}`} />
            <Circle cx={ringSize / 2} cy={ringSize / 2} r={radius} stroke={accentColor} strokeWidth={strokeWidth} fill="none" strokeDasharray={`${circumference}`} strokeDashoffset={strokeDashoffset} strokeLinecap="round" rotation={-90} origin={`${ringSize / 2}, ${ringSize / 2}`} />
          </Svg>
          <View style={{ position: 'absolute', alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>{streak}</Text>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>
            {streak === 0 ? 'Start your streak' : `${streak}-day streak`}
          </Text>
          <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 1 }}>
            {streak === 0
              ? 'Your next workout kicks it off!'
              : `Best: ${maxStreak > 0 ? maxStreak : streak} days`}
          </Text>
        </View>
      </View>
    );
  }

  if (size === 'mini') {
    const ringSize = 48;
    const strokeWidth = 4;
    const radius = (ringSize - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - progress);

    return (
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={ringSize} height={ringSize}>
          <Circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            stroke={theme.border}
            strokeWidth={strokeWidth}
            fill="none"
            rotation={-90}
            origin={`${ringSize / 2}, ${ringSize / 2}`}
          />
          <Circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            stroke={accentColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation={-90}
            origin={`${ringSize / 2}, ${ringSize / 2}`}
          />
        </Svg>
        <View style={{ position: 'absolute', alignItems: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: theme.text }}>{streak}</Text>
        </View>
      </View>
    );
  }

  // Large variant
  const ringSize = 80;
  const strokeWidth = 6;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <View style={{
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    }}>
      {/* Ring */}
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={ringSize} height={ringSize}>
          <Circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            stroke={theme.border}
            strokeWidth={strokeWidth}
            fill="none"
            rotation={-90}
            origin={`${ringSize / 2}, ${ringSize / 2}`}
          />
          <Circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            stroke={accentColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation={-90}
            origin={`${ringSize / 2}, ${ringSize / 2}`}
          />
        </Svg>
        <View style={{ position: 'absolute', alignItems: 'center' }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text }}>{streak}</Text>
          <Text style={{ fontSize: 9, fontWeight: '500', color: theme.text, opacity: 0.5, marginTop: -2 }}>streak</Text>
        </View>
      </View>

      {/* Text content */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>
          {streak === 0 ? 'Start your streak' : `${streak}-day streak`}
        </Text>
        <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
          {streak === 0
            ? 'Your next workout kicks it off!'
            : remaining > 0
              ? `Best: ${maxStreak > 0 ? maxStreak : streak} days`
              : `${goal}-day goal reached!`}
        </Text>
      </View>
    </View>
  );
}
