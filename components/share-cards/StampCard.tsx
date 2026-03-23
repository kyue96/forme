import React from 'react';
import { Text, View } from 'react-native';
import { formatNumber } from '@/lib/utils';
import { ShareCardData } from './types';

const FONT = {
  brand: { fontSize: 10, fontWeight: '800' as const, letterSpacing: 2 },
  hero: { fontSize: 32, fontWeight: '900' as const, letterSpacing: -1 },
  unit: { fontSize: 10, fontWeight: '600' as const, letterSpacing: 1.5 },
  statValue: { fontSize: 16, fontWeight: '800' as const, letterSpacing: -0.5 },
  statLabel: { fontSize: 8, fontWeight: '500' as const, letterSpacing: 1.5 },
};

interface Props {
  data: ShareCardData;
}

export const StampCard = React.forwardRef<View, Props>(({ data }, ref) => {
  const accent = data.accentColor || null;
  const densityStr = data.density > 0 ? formatNumber(data.density) : '\u2014';
  const intensityStr = data.avgIntensity > 0 ? `${data.avgIntensity}` : '\u2014';
  const durationStr = data.durationMinutes < 60
    ? `${data.durationMinutes}M`
    : `${Math.floor(data.durationMinutes / 60)}H${data.durationMinutes % 60 > 0 ? data.durationMinutes % 60 : ''}`;

  return (
    <View
      ref={ref}
      collapsable={false}
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 14,
        minWidth: 170,
      }}
    >
      <Text style={{ ...FONT.brand, color: accent || '#999999', marginBottom: 4 }}>FORME</Text>
      <Text style={{ ...FONT.hero, color: '#000000' }}>
        {formatNumber(Math.round(data.totalVolume))}
      </Text>
      <Text style={{ ...FONT.unit, color: accent || '#999999', marginBottom: 10 }}>
        {data.unitLabel.toUpperCase()} MOVED
      </Text>

      <View style={{ flexDirection: 'row', gap: 16 }}>
        <View>
          <Text style={{ ...FONT.statValue, color: '#000000', fontVariant: ['tabular-nums'] }}>{densityStr}</Text>
          <Text style={{ ...FONT.statLabel, color: accent || '#999999' }}>
            {data.unitLabel.toUpperCase()}/M
          </Text>
        </View>
        <View>
          <Text style={{ ...FONT.statValue, color: '#000000', fontVariant: ['tabular-nums'] }}>{intensityStr}</Text>
          <Text style={{ ...FONT.statLabel, color: accent || '#999999' }}>EFFORT</Text>
        </View>
        <View>
          <Text style={{ ...FONT.statValue, color: '#000000', fontVariant: ['tabular-nums'] }}>{durationStr}</Text>
          <Text style={{ ...FONT.statLabel, color: accent || '#999999' }}>TIME</Text>
        </View>
      </View>
    </View>
  );
});
