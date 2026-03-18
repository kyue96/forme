import React from 'react';
import { View, Text } from 'react-native';
import { useSettings } from '@/lib/settings-context';

// Subtle color coding per category
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Chest:      { bg: '#EF444420', text: '#EF4444' },
  Back:       { bg: '#3B82F620', text: '#3B82F6' },
  Shoulders:  { bg: '#F59E0B20', text: '#F59E0B' },
  Biceps:     { bg: '#8B5CF620', text: '#8B5CF6' },
  Triceps:    { bg: '#A855F720', text: '#A855F7' },
  Legs:       { bg: '#22C55E20', text: '#22C55E' },
  Core:       { bg: '#EC489920', text: '#EC4899' },
  Cardio:     { bg: '#06B6D420', text: '#06B6D4' },
  Bands:      { bg: '#F9731620', text: '#F97316' },
  'Full Body': { bg: '#6366F120', text: '#6366F1' },
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
        const colors = CATEGORY_COLORS[cat] ?? { bg: theme.chromeLight, text: theme.textSecondary };
        return (
          <View
            key={cat}
            style={{
              backgroundColor: colors.bg,
              paddingHorizontal: isSmall ? 6 : 8,
              paddingVertical: isSmall ? 2 : 3,
              borderRadius: 8,
            }}
          >
            <Text
              style={{
                fontSize: isSmall ? 9 : 11,
                fontWeight: '600',
                color: colors.text,
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
