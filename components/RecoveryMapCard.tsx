import React, { useMemo, useRef, useEffect, useState } from 'react';
import { View, Text, Pressable, Animated as RNAnimated } from 'react-native';
import { useSettings } from '@/lib/settings-context';
import { getExerciseCategory } from '@/lib/exercise-utils';
import type { LoggedExercise } from '@/lib/types';
import { isUnilateralExercise } from '@/lib/workout-metrics';

interface RecentLog {
  exercises: LoggedExercise[];
  completed_at: string;
}

interface RecoveryMapCardProps {
  recentLogs: RecentLog[];
}

const MUSCLE_GROUPS: { key: string; label: string; categories: string[] }[] = [
  { key: 'chest', label: 'CHEST', categories: ['Chest'] },
  { key: 'back', label: 'BACK', categories: ['Back', 'Traps'] },
  { key: 'shoulders', label: 'SHOULDERS', categories: ['Shoulders'] },
  { key: 'arms', label: 'ARMS', categories: ['Biceps', 'Triceps'] },
  { key: 'legs', label: 'LEGS', categories: ['Legs'] },
  { key: 'core', label: 'CORE', categories: ['Core'] },
];

/* ── Animated pill for fatigued (recently worked) muscles ── */
function FatiguedPill({ color, label, hoursAgo, volume, theme, weightUnit }: {
  color: string;
  label: string;
  hoursAgo: number | null;
  volume: number;
  theme: any;
  weightUnit: string;
}) {
  const breathAnim = useRef(new RNAnimated.Value(0.6)).current;
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    const anim = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(breathAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
        RNAnimated.timing(breathAnim, { toValue: 0.6, duration: 2000, useNativeDriver: false }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const displayVol = weightUnit === 'lbs' ? Math.round(volume * 2.205) : Math.round(volume);
  const unit = weightUnit === 'lbs' ? 'lbs' : 'kg';
  const timeLabel = hoursAgo === null
    ? ''
    : hoursAgo < 24
      ? `${Math.round(hoursAgo)}h ago`
      : `${Math.round(hoursAgo / 24)}d ago`;

  // Interpolate shadow opacity for the glow effect
  const glowOpacity = breathAnim.interpolate({
    inputRange: [0.6, 1],
    outputRange: [0.3, 0.8],
  });

  return (
    <View style={{ position: 'relative' }}>
      <Pressable onPress={() => setShowTooltip(!showTooltip)}>
        <RNAnimated.View style={{
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 20,
          backgroundColor: color + '25',
          borderWidth: 1.5,
          borderColor: color,
          opacity: breathAnim,
          // Shadow for glow effect
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: glowOpacity as any,
          shadowRadius: 8,
          elevation: 4,
        }}>
          <Text style={{
            fontSize: 11,
            fontWeight: '700',
            color: color,
            letterSpacing: 0.5,
          }}>
            {label}
          </Text>
        </RNAnimated.View>
      </Pressable>

      {showTooltip && (
        <Pressable
          onPress={() => setShowTooltip(false)}
          style={{
            position: 'absolute', top: 38, left: -10, zIndex: 10,
            backgroundColor: theme.surface, borderRadius: 10,
            borderWidth: 1, borderColor: theme.border,
            paddingHorizontal: 10, paddingVertical: 6,
            minWidth: 110, alignItems: 'center',
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '600', color: theme.text }}>{timeLabel}</Text>
          {volume > 0 && (
            <Text style={{ fontSize: 10, color: theme.textSecondary, marginTop: 2 }}>
              {displayVol.toLocaleString()} {unit} volume
            </Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

/* ── Green pill for fresh/ready muscles ── */
function FreshPill({ label }: { label: string }) {
  const greenColor = '#22C55E';
  return (
    <View style={{
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: greenColor + '20',
      borderWidth: 1.5,
      borderColor: greenColor,
    }}>
      <Text style={{
        fontSize: 11,
        fontWeight: '700',
        color: greenColor,
        letterSpacing: 0.5,
      }}>
        {label}
      </Text>
    </View>
  );
}

export default function RecoveryMapCard({ recentLogs }: RecoveryMapCardProps) {
  const { theme, weightUnit } = useSettings();

  const muscleData = useMemo(() => {
    const now = Date.now();

    return MUSCLE_GROUPS.map((group) => {
      let mostRecentHours: number | null = null;
      let totalVolume = 0;

      for (const log of recentLogs) {
        const logTime = new Date(log.completed_at).getTime();
        const hours = (now - logTime) / (1000 * 60 * 60);

        let groupVolume = 0;
        let hitThisGroup = false;

        for (const ex of log.exercises) {
          const cat = getExerciseCategory(ex.name);
          if (cat && group.categories.includes(cat)) {
            hitThisGroup = true;
            const mul = isUnilateralExercise(ex.name) ? 2 : 1;
            for (const s of ex.sets) {
              if (s.completed && s.weight != null && s.reps > 0) {
                groupVolume += s.weight * s.reps * mul;
              }
            }
          }
        }

        if (hitThisGroup) {
          if (mostRecentHours === null || hours < mostRecentHours) {
            mostRecentHours = hours;
          }
          totalVolume += groupVolume;
        }
      }

      // Fatigued if worked in last 48h
      let color: string;
      let isFatigued: boolean;
      if (mostRecentHours !== null && mostRecentHours < 48) {
        isFatigued = true;
        color = mostRecentHours < 24 ? '#EF4444' : '#F59E0B'; // red <24h, amber 24-48h
      } else {
        isFatigued = false;
        color = '#22C55E';
      }

      return {
        ...group,
        hoursAgo: mostRecentHours,
        volume: totalVolume,
        color,
        isFatigued,
      };
    });
  }, [recentLogs]);

  // Separate fatigued (worked) and fresh (ready) muscles
  const fatigued = muscleData.filter((m) => m.isFatigued);
  const fresh = muscleData.filter((m) => !m.isFatigued);

  return (
    <View style={{
      backgroundColor: theme.surface, borderRadius: 16,
      borderWidth: 1, borderColor: theme.border, padding: 14,
    }}>
      <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text, marginBottom: 12 }}>
        Muscle Recovery Map
      </Text>
      {(() => {
        const allPills = [
          ...fatigued.map((m) => ({ ...m, type: 'fatigued' as const })),
          ...fresh.map((m) => ({ ...m, type: 'fresh' as const })),
        ];
        const total = allPills.length;
        const topCount = total <= 4 ? Math.ceil(total / 2) : Math.ceil(total / 2);
        const topRow = allPills.slice(0, topCount);
        const bottomRow = allPills.slice(topCount);

        const renderPill = (m: typeof allPills[0]) =>
          m.type === 'fatigued' ? (
            <FatiguedPill
              key={m.key}
              color={m.color}
              label={m.label}
              hoursAgo={m.hoursAgo}
              volume={m.volume}
              theme={theme}
              weightUnit={weightUnit}
            />
          ) : (
            <FreshPill key={m.key} label={m.label} />
          );

        return (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
              {topRow.map(renderPill)}
            </View>
            {bottomRow.length > 0 && (
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                {bottomRow.map(renderPill)}
              </View>
            )}
          </View>
        );
      })()}
    </View>
  );
}
