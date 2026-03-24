import React from 'react';
import { Text, View } from 'react-native';
import { formatNumber } from '@/lib/utils';
import { ShareCardData } from './types';

// Shared font constants used across all card variants
const FONT = {
  brand: { fontSize: 14, fontWeight: '800' as const, letterSpacing: 3 },
  hero: { fontSize: 56, fontWeight: '900' as const, letterSpacing: -2 },
  unit: { fontSize: 18, fontWeight: '700' as const, letterSpacing: 6 },
  statValue: { fontSize: 16, fontWeight: '700' as const, letterSpacing: 0 },
  statLabel: { fontSize: 11, fontWeight: '500' as const, letterSpacing: 2 },
  sub: { fontSize: 13, fontWeight: '400' as const, letterSpacing: 0.5 },
};

interface Props {
  data: ShareCardData;
}

export const MagazineCard = React.forwardRef<View, Props>(({ data }, ref) => {
  const accent = data.accentColor || null;
  const unitWord = data.unitLabel === 'lbs' ? 'POUNDS' : 'KILOGRAMS';
  const bestSetName = data.bestSet
    ? data.bestSet.exerciseName.replace(/\s*\(.*\)/, '')
    : null;
  const bestSetWeight = data.bestSet
    ? `${formatNumber(data.bestSet.weight)} \u00D7 ${data.bestSet.reps}`
    : null;
  const densityStr = data.density > 0 ? `${formatNumber(data.density)}` : null;
  const intensityStr = data.avgIntensity > 0 ? `${data.avgIntensity} / 100` : null;
  const durationStr = data.durationMinutes < 60
    ? `${data.durationMinutes} min`
    : `${Math.floor(data.durationMinutes / 60)}h ${data.durationMinutes % 60}m`;

  const stats: { label: string; value: string; subLabel?: string }[] = [];
  if (densityStr) stats.push({ label: `${data.unitLabel.toUpperCase()}/MIN`, value: densityStr });
  if (intensityStr) stats.push({ label: 'EFFORT SCORE', value: intensityStr });
  if (bestSetName) stats.push({ label: 'BEST SET', value: bestSetWeight!, subLabel: bestSetName });
  stats.push({ label: 'DURATION', value: durationStr });

  return (
    <View
      ref={ref}
      collapsable={false}
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 28,
        width: 320,
        gap: 20,
      }}
    >
      {/* Header */}
      <View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ ...FONT.brand, color: accent || '#000000' }}>FORME</Text>
          <Text style={{ fontSize: 12, fontWeight: '500', color: '#999999', letterSpacing: 1 }}>
            {data.date.toUpperCase()}
          </Text>
        </View>
        <View style={{ height: 2, backgroundColor: accent || '#000000', marginTop: 14 }} />
        {data.focus ? (
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#000000', marginTop: 10 }} numberOfLines={1}>
            {data.focus}
          </Text>
        ) : null}
      </View>

      {/* Hero volume */}
      <View style={{ alignItems: 'flex-start', paddingVertical: 8 }}>
        <Text style={{ fontSize: 11, fontWeight: '500', color: '#999999', letterSpacing: 2, marginBottom: 8 }}>
          TOTAL VOLUME
        </Text>
        <Text
          adjustsFontSizeToFit
          numberOfLines={1}
          style={{ ...FONT.hero, color: '#000000' }}
        >
          {formatNumber(Math.round(data.totalVolume))}
        </Text>
        <Text style={{ ...FONT.unit, color: accent || '#000000', marginTop: 2 }}>
          {unitWord}
        </Text>
      </View>

      {/* Divider + comparison */}
      <View>
        <View style={{ height: 1, backgroundColor: '#E0E0E0', marginBottom: 12 }} />
        <Text style={{ ...FONT.sub, color: '#999999', fontStyle: 'italic' }}>
          {data.volumeComparison}
        </Text>
      </View>

      {/* Stats */}
      <View>
        {stats.map((stat, i) => (
          <View key={stat.label}>
            {i > 0 && <View style={{ height: 1, backgroundColor: '#E0E0E0' }} />}
            <View style={{ paddingVertical: 10 }}>
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <Text style={{ ...FONT.statLabel, color: '#999999', flexShrink: 0 }}>{stat.label}</Text>
                <Text
                  style={{ ...FONT.statValue, color: '#000000', fontVariant: ['tabular-nums'], flexShrink: 1, textAlign: 'right' }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >{stat.value}</Text>
              </View>
              {stat.subLabel && (
                <Text style={{ fontSize: 11, fontWeight: '500', color: '#999999', textAlign: 'right', marginTop: 2 }} numberOfLines={1}>
                  {stat.subLabel}
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
});
