import React from 'react';
import { View, Text } from 'react-native';
import { useSettings } from '@/lib/settings-context';

// Solid background with white text for high contrast
const CATEGORY_COLORS: Record<string, string> = {
  Chest:      '#EF4444',
  Back:       '#3B82F6',
  Shoulders:  '#F59E0B',
  Traps:      '#14B8A6',
  Biceps:     '#8B5CF6',
  Triceps:    '#A855F7',
  Legs:       '#22C55E',
  Core:       '#EC4899',
  Cardio:     '#06B6D4',
  Bands:      '#F97316',
  'Full Body': '#6366F1',
};

interface MuscleGroupPillsProps {
  categories: string[];
  size?: 'small' | 'normal';
}

export function MuscleGroupPills({ categories, size = 'normal' }: MuscleGroupPillsProps) {
  const { theme } = useSettings();

  if (categories.length === 0) return null;

  const isSmall = size === 'small';

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: isSmall ? 4 : 6 }}>
      {categories.map((cat) => {
        const bg = CATEGORY_COLORS[cat] ?? theme.chrome;
        return (
          <View
            key={cat}
            style={{
              backgroundColor: bg,
              paddingHorizontal: isSmall ? 6 : 8,
              paddingVertical: isSmall ? 2 : 3,
              borderRadius: 8,
            }}
          >
            <Text
              style={{
                fontSize: isSmall ? 9 : 11,
                fontWeight: '600',
                color: '#FFFFFF',
                textTransform: 'uppercase',
              }}
            >
              {cat}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
