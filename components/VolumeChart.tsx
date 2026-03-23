import React, { useRef, useState } from 'react';
import { PanResponder, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { formatNumber } from '@/lib/utils';

export interface VolumeChartData {
  volume: number;
  date: string;
  label: string;
}

interface VolumeChartProps {
  data: VolumeChartData[];
  theme: any;
  avatarColor: string | null;
  currentIndex: number;
  unitLabel?: string;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

export function VolumeChart({ data, theme, avatarColor, currentIndex, unitLabel, onInteractionStart, onInteractionEnd }: VolumeChartProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const highlightColor = avatarColor || '#F59E0B';
  const chartHeight = 160;
  const barMinHeight = 4;
  const yAxisWidth = 52;
  const chartLayoutRef = useRef({ x: 0, width: 0 });

  // Y-axis: scale in increments of 5,000, max 100,000
  const rawMax = Math.max(...data.map(d => d.volume), 1);
  const scaleMax = Math.min(Math.ceil(rawMax / 5000) * 5000, 100000) || 5000;
  const tickCount = Math.min(scaleMax / 5000, 5);
  const ticks: number[] = [];
  for (let i = 0; i <= tickCount; i++) {
    ticks.push(Math.round((scaleMax / tickCount) * (tickCount - i)));
  }

  const getIndexFromX = (pageX: number) => {
    const { x, width } = chartLayoutRef.current;
    if (width === 0) return null;
    const relX = pageX - x;
    const idx = Math.floor((relX / width) * data.length);
    return Math.max(0, Math.min(data.length - 1, idx));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        onInteractionStart?.();
        const idx = getIndexFromX(e.nativeEvent.pageX);
        if (idx !== null) setSelectedIdx(prev => prev === idx ? null : idx);
      },
      onPanResponderMove: (e) => {
        const idx = getIndexFromX(e.nativeEvent.pageX);
        if (idx !== null) setSelectedIdx(idx);
      },
      onPanResponderRelease: () => { onInteractionEnd?.(); },
      onPanResponderTerminate: () => { onInteractionEnd?.(); },
    })
  ).current;

  // Which bar to show label for
  const activeIdx = selectedIdx ?? currentIndex;

  return (
    <View>
      {/* Volume label for selected/current bar */}
      <View style={{ height: 20, alignItems: 'center', marginBottom: 4 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: activeIdx === currentIndex ? highlightColor : theme.text }}>
          {formatNumber(data[activeIdx]?.volume ?? 0)} {unitLabel ?? ''} {activeIdx === currentIndex ? '(today)' : ''}
        </Text>
      </View>

      <View style={{ flexDirection: 'row' }}>
        {/* Y-axis */}
        <View style={{ width: yAxisWidth }}>
          {unitLabel && (
            <Text style={{ fontSize: 8, color: theme.textSecondary, fontWeight: '600', marginBottom: 2 }}>
              {unitLabel}
            </Text>
          )}
          <View style={{ height: chartHeight, justifyContent: 'space-between' }}>
            {ticks.map((tick, i) => (
              <Text key={i} style={{ fontSize: 9, color: theme.textSecondary, textAlign: 'left' }}>
                {formatNumber(tick)}
              </Text>
            ))}
          </View>
        </View>

        {/* Chart area with drag-to-scrub */}
        <View
          style={{ flex: 1, height: chartHeight, position: 'relative' }}
          onLayout={(e) => {
            e.target.measureInWindow((x, _y, width) => {
              chartLayoutRef.current = { x, width };
            });
          }}
          {...panResponder.panHandlers}
        >
          {/* Grid lines (behind bars) */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
            {ticks.map((_, i) => (
              <View
                key={`grid-${i}`}
                style={{
                  position: 'absolute',
                  top: (chartHeight / (ticks.length - 1)) * i,
                  left: 0,
                  right: 0,
                  height: 1,
                  backgroundColor: theme.border,
                  opacity: 0.3,
                }}
              />
            ))}
          </View>

          {/* Bars (in front of grid) */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: chartHeight, gap: 4, paddingHorizontal: 2, zIndex: 1 }}>
            {data.map((item, idx) => {
              const isCurrent = idx === currentIndex;
              const isSelected = idx === selectedIdx;
              const heightPercent = scaleMax > 0 ? (item.volume / scaleMax) * 100 : 0;
              const barHeight = Math.max(heightPercent * (chartHeight / 100), barMinHeight);
              const isActive = isCurrent || isSelected;

              const gradientColors = isCurrent
                ? [highlightColor, highlightColor + '80'] as const
                : isSelected
                  ? [theme.text, theme.text + '80'] as const
                  : [theme.chrome + '50', theme.chrome + '20'] as const;

              return (
                <View
                  key={idx}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: chartHeight }}
                >
                  <LinearGradient
                    colors={gradientColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={{
                      width: '80%',
                      height: barHeight,
                      borderRadius: 6,
                      ...(isActive && {
                        shadowColor: isCurrent ? highlightColor : theme.text,
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.35,
                        shadowRadius: 6,
                        elevation: 4,
                      }),
                    }}
                  />
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* X-axis: Date labels */}
      <View style={{ flexDirection: 'row', gap: 4, marginTop: 6, marginLeft: yAxisWidth, paddingHorizontal: 2 }}>
        {data.map((item, idx) => (
          <Text
            key={idx}
            style={{
              flex: 1,
              fontSize: 9,
              fontWeight: idx === currentIndex || idx === selectedIdx ? '700' : '400',
              color: idx === currentIndex ? highlightColor : (idx === selectedIdx ? theme.text : theme.textSecondary),
              textAlign: 'center',
            }}
          >
            {item.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
