import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '@/lib/settings-context';
import { useBadgeStore } from '@/lib/badge-store';
import { BADGES, BadgeDefinition, TIER_COLORS, CATEGORY_LABELS, BadgeCategory } from '@/lib/badge-definitions';

function BadgeCard({ badge }: { badge: BadgeDefinition }) {
  const { theme } = useSettings();
  const earnedBadges = useBadgeStore((s) => s.earnedBadges);
  const getProgress = useBadgeStore((s) => s.getProgress);

  const earned = !!earnedBadges[badge.id];
  const progress = getProgress(badge);
  const tierColor = TIER_COLORS[badge.tier];

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: earned ? theme.surface : theme.background,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: earned ? tierColor : theme.border,
        opacity: earned ? 1 : 0.6,
      }}
    >
      <View style={{ alignItems: 'center', marginBottom: 8 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: earned ? tierColor + '20' : theme.chromeLight,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {earned ? (
            <Ionicons name={badge.icon as any} size={22} color={tierColor} />
          ) : (
            <Ionicons name="lock-closed-outline" size={18} color={theme.textSecondary} />
          )}
        </View>
      </View>
      <Text
        style={{
          fontSize: 12,
          fontWeight: '700',
          color: earned ? theme.text : theme.textSecondary,
          textAlign: 'center',
          marginBottom: 2,
        }}
        numberOfLines={1}
      >
        {badge.name}
      </Text>
      <Text
        style={{
          fontSize: 10,
          color: theme.textSecondary,
          textAlign: 'center',
          marginBottom: 8,
        }}
        numberOfLines={2}
      >
        {badge.description}
      </Text>
      {earned ? (
        <View style={{ backgroundColor: tierColor + '20', borderRadius: 8, paddingVertical: 3, paddingHorizontal: 6, alignSelf: 'center' }}>
          <Text style={{ fontSize: 9, fontWeight: '600', color: tierColor }}>
            Earned
          </Text>
        </View>
      ) : (
        <View>
          <View
            style={{
              height: 4,
              backgroundColor: theme.chromeLight,
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: 4,
                width: `${progress.percent * 100}%`,
                backgroundColor: theme.chrome,
                borderRadius: 2,
              }}
            />
          </View>
          <Text style={{ fontSize: 9, color: theme.textSecondary, textAlign: 'center', marginTop: 3 }}>
            {progress.current}/{progress.target}
          </Text>
        </View>
      )}
    </View>
  );
}

export function BadgesTab() {
  const { theme } = useSettings();
  const earnedBadges = useBadgeStore((s) => s.earnedBadges);
  const earnedCount = Object.keys(earnedBadges).length;

  // Group badges by category
  const categories = ['consistency', 'volume', 'milestones', 'records', 'variety'] as BadgeCategory[];
  const grouped = categories.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    badges: BADGES.filter((b) => b.category === cat),
  }));

  return (
    <View>
      {/* Badge grid by category */}
      {grouped.map((group) => (
        <View key={group.category} style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>
            {group.label}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {group.badges.map((badge) => (
              <View key={badge.id} style={{ width: '47%' }}>
                <BadgeCard badge={badge} />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
