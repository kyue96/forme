import React from 'react';
import { View, Text } from 'react-native';
import { useSettings } from '@/lib/settings-context';
import { formatNumber } from '@/lib/utils';

interface DayVolume {
  day: string;
  volume: number;
}

interface WeeklyVolumeCardProps {
  weeks: [DayVolume[], DayVolume[], DayVolume[]]; // [W1, W2, W3(current)]
  totalVolume: number;
  deltaPercent: number | null;
  accentColor?: string;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEK_LABELS = ['W1', 'W2', 'W3'];

export function WeeklyVolumeCard({ weeks, totalVolume, deltaPercent, accentColor }: WeeklyVolumeCardProps) {
  const { theme, weightUnit } = useSettings();
  const highlight = accentColor || '#F59E0B';

  // Find max volume across all days for scaling
  const allVolumes = weeks.flat().map((d) => d.volume);
  const maxVol = Math.max(...allVolumes, 1);

  // Find PR day (highest single-day volume)
  const prVolume = Math.max(...allVolumes);

  const chartHeight = 100;
  const barMinHeight = 3;

  return (
    <View style={{
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>weekly volume</Text>
          <Text style={{ fontSize: 10, color: theme.textSecondary, marginTop: 1 }}>
            total {weightUnit === 'lbs' ? 'lbs' : 'kg'} lifted
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text }}>
            {formatNumber(totalVolume)}
          </Text>
          {deltaPercent != null && (
            <Text style={{
              fontSize: 11,
              fontWeight: '600',
              color: deltaPercent >= 0 ? '#22C55E' : '#EF4444',
              marginTop: 1,
            }}>
              {deltaPercent >= 0 ? '+' : ''}{Math.round(deltaPercent)}% vs last week
            </Text>
          )}
        </View>
      </View>

      {/* Bar chart — 3 week groups */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: chartHeight, marginTop: 16, gap: 2 }}>
        {weeks.map((weekData, weekIdx) => (
          <React.Fragment key={weekIdx}>
            {/* Week group */}
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', height: chartHeight, gap: 2 }}>
              {weekData.map((day, dayIdx) => {
                const isCurrentWeek = weekIdx === 2;
                const isPR = day.volume > 0 && day.volume === prVolume;
                const heightPct = maxVol > 0 ? (day.volume / maxVol) * 100 : 0;
                const barHeight = Math.max(heightPct * (chartHeight / 100), day.volume > 0 ? barMinHeight : 0);

                let barColor: string;
                if (isPR && day.volume > 0) {
                  barColor = highlight;
                } else if (isCurrentWeek) {
                  barColor = theme.text;
                } else {
                  barColor = theme.chrome + '60';
                }

                return (
                  <View key={dayIdx} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: chartHeight }}>
                    <View style={{
                      width: '80%',
                      height: barHeight,
                      backgroundColor: barColor,
                      borderRadius: 3,
                      opacity: isPR ? 1 : isCurrentWeek ? 0.9 : 0.4,
                    }} />
                  </View>
                );
              })}
            </View>
            {/* Week separator */}
            {weekIdx < 2 && (
              <View style={{ width: 6 }} />
            )}
          </React.Fragment>
        ))}
      </View>

      {/* Week labels */}
      <View style={{ flexDirection: 'row', marginTop: 6 }}>
        {WEEK_LABELS.map((label, idx) => (
          <React.Fragment key={idx}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, fontWeight: '500', color: theme.textSecondary }}>
                {label}
              </Text>
            </View>
            {idx < 2 && <View style={{ width: 6 }} />}
          </React.Fragment>
        ))}
      </View>

      {/* Legend */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.chrome, opacity: 0.4 }} />
          <Text style={{ fontSize: 9, color: theme.textSecondary }}>prev weeks</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.text }} />
          <Text style={{ fontSize: 9, color: theme.textSecondary }}>this week</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: highlight }} />
          <Text style={{ fontSize: 9, color: theme.textSecondary }}>PR day</Text>
        </View>
      </View>
    </View>
  );
}
