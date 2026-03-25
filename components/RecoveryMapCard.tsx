import React, { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Svg, { Path, Ellipse } from 'react-native-svg';
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
  { key: 'chest', label: 'Chest', categories: ['Chest'] },
  { key: 'back', label: 'Back', categories: ['Back', 'Traps'] },
  { key: 'shoulders', label: 'Shoulders', categories: ['Shoulders'] },
  { key: 'arms', label: 'Arms', categories: ['Biceps', 'Triceps'] },
  { key: 'legs', label: 'Legs', categories: ['Legs'] },
  { key: 'core', label: 'Core', categories: ['Core'] },
];

type MuscleStatus = {
  key: string;
  label: string;
  hoursAgo: number | null;
  volume: number;
  color: string;
  statusLabel: string;
};

/* ─── Human silhouette SVG paths ─── */
const SVG_W = 120;
const SVG_H = 200;

function BodySilhouette({ muscleColors, theme }: { muscleColors: Record<string, string>; theme: any }) {
  const baseColor = theme.text + '15'; // ~8% opacity, visible on both light/dark
  const outlineColor = theme.text + '30'; // ~19% opacity for head/neck outline

  return (
    <Svg width={SVG_W} height={SVG_H} viewBox="0 0 120 200">
      {/* Head */}
      <Ellipse cx="60" cy="18" rx="11" ry="13" fill="#22C55E" opacity={0.5} stroke="#22C55E" strokeWidth={0.5} />

      {/* Neck */}
      <Path d="M55 30 Q55 36 54 38 L66 38 Q65 36 65 30 Z" fill="#22C55E" opacity={0.3} />

      {/* Shoulders - trapezius area */}
      <Path
        d="M54 38 Q42 39 32 46 L36 50 Q44 44 54 43 Z"
        fill={muscleColors.shoulders || baseColor}
        opacity={0.7}
      />
      <Path
        d="M66 38 Q78 39 88 46 L84 50 Q76 44 66 43 Z"
        fill={muscleColors.shoulders || baseColor}
        opacity={0.7}
      />

      {/* Chest / Torso upper */}
      <Path
        d="M54 43 Q48 44 44 48 L44 68 Q48 72 54 73 L66 73 Q72 72 76 68 L76 48 Q72 44 66 43 Z"
        fill={muscleColors.chest || baseColor}
        opacity={0.65}
      />

      {/* Back (visible as side strips flanking the torso) */}
      <Path
        d="M44 43 Q40 45 38 50 L37 72 Q38 76 42 78 L44 78 L44 48 Z"
        fill={muscleColors.back || baseColor}
        opacity={0.7}
      />
      <Path
        d="M76 43 Q80 45 82 50 L83 72 Q82 76 78 78 L76 78 L76 48 Z"
        fill={muscleColors.back || baseColor}
        opacity={0.7}
      />

      {/* Core / Abs */}
      <Path
        d="M50 73 Q48 74 47 76 L47 98 Q49 102 54 103 L66 103 Q71 102 73 98 L73 76 Q72 74 70 73 Z"
        fill={muscleColors.core || baseColor}
        opacity={0.6}
      />

      {/* Left arm - upper */}
      <Path
        d="M36 50 Q32 52 30 56 L28 78 Q28 82 31 84 L36 84 Q39 82 39 78 L40 56 Q40 52 38 50 Z"
        fill={muscleColors.arms || baseColor}
        opacity={0.65}
      />
      {/* Left arm - forearm */}
      <Path
        d="M29 84 Q27 86 26 90 L24 108 Q24 112 27 113 L31 113 Q34 112 34 108 L35 90 Q35 86 34 84 Z"
        fill={muscleColors.arms || baseColor}
        opacity={0.5}
      />

      {/* Right arm - upper */}
      <Path
        d="M84 50 Q88 52 90 56 L92 78 Q92 82 89 84 L84 84 Q81 82 81 78 L80 56 Q80 52 82 50 Z"
        fill={muscleColors.arms || baseColor}
        opacity={0.65}
      />
      {/* Right arm - forearm */}
      <Path
        d="M91 84 Q93 86 94 90 L96 108 Q96 112 93 113 L89 113 Q86 112 86 108 L85 90 Q85 86 86 84 Z"
        fill={muscleColors.arms || baseColor}
        opacity={0.5}
      />

      {/* Left leg - thigh */}
      <Path
        d="M48 103 Q46 105 45 110 L43 142 Q43 146 46 148 L54 148 Q57 146 57 142 L56 110 Q56 106 55 103 Z"
        fill={muscleColors.legs || baseColor}
        opacity={0.65}
      />
      {/* Left leg - calf */}
      <Path
        d="M44 148 Q42 152 42 156 L41 180 Q41 184 44 186 L52 186 Q55 184 55 180 L55 156 Q55 152 54 148 Z"
        fill={muscleColors.legs || baseColor}
        opacity={0.5}
      />

      {/* Right leg - thigh */}
      <Path
        d="M65 103 Q64 106 64 110 L63 142 Q63 146 66 148 L74 148 Q77 146 77 142 L75 110 Q74 105 72 103 Z"
        fill={muscleColors.legs || baseColor}
        opacity={0.65}
      />
      {/* Right leg - calf */}
      <Path
        d="M66 148 Q65 152 65 156 L65 180 Q65 184 68 186 L76 186 Q79 184 79 180 L78 156 Q78 152 77 148 Z"
        fill={muscleColors.legs || baseColor}
        opacity={0.5}
      />

      {/* Hands */}
      <Ellipse cx="27" cy="117" rx="4" ry="5" fill={baseColor} opacity={0.3} />
      <Ellipse cx="93" cy="117" rx="4" ry="5" fill={baseColor} opacity={0.3} />

      {/* Feet */}
      <Ellipse cx="48" cy="190" rx="6" ry="4" fill={baseColor} opacity={0.3} />
      <Ellipse cx="72" cy="190" rx="6" ry="4" fill={baseColor} opacity={0.3} />
    </Svg>
  );
}

/* ─── Legend row ─── */
function LegendDot({ color, label, theme }: { color: string; label: string; theme: any }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ fontSize: 10, color: theme.textSecondary, fontWeight: '500' }}>{label}</Text>
    </View>
  );
}

export default function RecoveryMapCard({ recentLogs }: RecoveryMapCardProps) {
  const { theme, weightUnit } = useSettings();
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);

  const muscleData = useMemo(() => {
    const now = Date.now();

    return MUSCLE_GROUPS.map((group): MuscleStatus => {
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

      let color: string;
      let statusLabel: string;
      if (mostRecentHours !== null && mostRecentHours < 24) {
        color = '#EF4444';
        const h = Math.round(mostRecentHours);
        statusLabel = h === 0 ? 'Just worked' : `${h}h ago`;
      } else if (mostRecentHours !== null && mostRecentHours < 48) {
        color = '#F59E0B';
        statusLabel = `${Math.round(mostRecentHours)}h ago`;
      } else {
        color = '#22C55E';
        statusLabel = 'Fresh';
      }

      return {
        ...group,
        hoursAgo: mostRecentHours,
        volume: totalVolume,
        color,
        statusLabel,
      };
    });
  }, [recentLogs]);

  // Build color map for the silhouette
  const muscleColors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of muscleData) {
      map[m.key] = m.color;
    }
    return map;
  }, [muscleData]);

  const selected = muscleData.find(m => m.key === selectedMuscle);
  const unit = weightUnit === 'lbs' ? 'lbs' : 'kg';

  return (
    <View style={{
      backgroundColor: theme.surface, borderRadius: 16,
      borderWidth: 1, borderColor: theme.border, padding: 16,
    }}>
      {/* Header */}
      <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text, marginBottom: 4 }}>
        Muscle Recovery
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        {/* Body silhouette */}
        <View style={{ alignItems: 'center', marginRight: 12, marginTop: 4 }}>
          <BodySilhouette muscleColors={muscleColors} theme={theme} />
        </View>

        {/* Muscle list */}
        <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 8, gap: 4 }}>
          {muscleData.map((m) => (
            <Pressable
              key={m.key}
              onPress={() => setSelectedMuscle(selectedMuscle === m.key ? null : m.key)}
              style={{
                flexDirection: 'row', alignItems: 'center',
                paddingVertical: 6, paddingHorizontal: 10,
                borderRadius: 8,
                backgroundColor: selectedMuscle === m.key ? m.color + '15' : 'transparent',
              }}
            >
              <View style={{
                width: 8, height: 8, borderRadius: 4,
                backgroundColor: m.color,
                marginRight: 8,
              }} />
              <Text style={{
                fontSize: 13, fontWeight: '600',
                color: theme.text, flex: 1,
              }}>
                {m.label}
              </Text>
              <Text style={{
                fontSize: 11, color: m.color,
                fontWeight: '600',
              }}>
                {m.statusLabel}
              </Text>
            </Pressable>
          ))}

          {/* Volume detail for selected muscle */}
          {selected && selected.volume > 0 && (
            <View style={{
              marginTop: 4, marginLeft: 26,
              paddingVertical: 4, paddingHorizontal: 8,
              backgroundColor: theme.background, borderRadius: 6,
            }}>
              <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                {Math.round(selected.volume).toLocaleString()} {unit} volume
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Legend */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.border }}>
        <LegendDot color="#EF4444" label="Worked Today" theme={theme} />
        <LegendDot color="#F59E0B" label="Recovering" theme={theme} />
        <LegendDot color="#22C55E" label="Fresh" theme={theme} />
      </View>
    </View>
  );
}
