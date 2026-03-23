import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useSettings } from '@/lib/settings-context';
import { formatNumber } from '@/lib/utils';

interface DayVolume {
  day: string;
  volume: number;
  name?: string;
}

interface WeeklyVolumeCardProps {
  weeks: [DayVolume[], DayVolume[], DayVolume[]]; // [W1, W2, W3(current)]
  totalVolume: number;
  deltaPercent: number | null;
  accentColor?: string;
}

const WEEK_LABELS = ['W1', 'W2', 'W3', 'This Week'];

export function WeeklyVolumeCard({ weeks, totalVolume, deltaPercent, accentColor }: WeeklyVolumeCardProps) {
  const { theme, weightUnit } = useSettings();
  const highlight = accentColor || '#F59E0B';
  const unitLabel = weightUnit === 'lbs' ? 'lbs' : 'kg';
  const convert = (kg: number) => weightUnit === 'lbs' ? Math.round(kg * 2.205) : Math.round(kg);

  const [selectedBar, setSelectedBar] = useState<{ weekIdx: number; dayIdx: number } | null>(null);

  // Convert all volumes for display
  const allConverted = weeks.flat().map((d) => convert(d.volume));
  const maxConverted = Math.max(...allConverted, 1);

  // Find PR (in converted units)
  const prConverted = Math.max(...allConverted);

  // Y-axis: fixed 5k increments
  const step = 5000;
  const topTick = Math.ceil(maxConverted / step) * step;
  const yTicks: number[] = [];
  for (let v = topTick; v >= 0; v -= step) {
    yTicks.push(v);
  }

  const chartHeight = 120;
  const Y_AXIS_W = 32;
  const WEEK_MIN_W = 80; // minimum width per week group for horizontal scrolling

  // Selected bar info
  const sel = selectedBar;
  const selDay = sel ? weeks[sel.weekIdx]?.[sel.dayIdx] : null;
  const selName = selDay?.name ? selDay.name.split(/[\s(]/)[0] : null;
  const selVol = selDay ? convert(selDay.volume) : null;
  const selDate = selDay?.day ? (() => {
    const d = new Date(selDay.day + 'T12:00:00');
    return `${d.getMonth() + 1}/${d.getDate()}`;
  })() : null;

  // X-axis labels: W1, W2, W3, This Week (map to actual weeks we have)
  const xLabels = weeks.map((_, i) => {
    if (i === weeks.length - 1) return 'This Week';
    return `W${i + 1}`;
  });

  return (
    <View style={{
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <View>
          <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>Weekly Volume</Text>
          <Text style={{ fontSize: 10, color: theme.textSecondary, marginTop: 2 }}>
            total {unitLabel} lifted · 3 weeks
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text, fontVariant: ['tabular-nums'] }}>
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

      {/* Interactive tooltip */}
      <View style={{ height: 28, justifyContent: 'center', marginBottom: 8 }}>
        {selDay ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: highlight }} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>
              {selName ?? 'Workout'}
            </Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary }}>
              {formatNumber(selVol ?? 0)} {unitLabel}
            </Text>
            <Text style={{ fontSize: 11, color: theme.textSecondary }}>
              {selDate}
            </Text>
          </View>
        ) : (
          <Text style={{ fontSize: 11, color: theme.textSecondary, fontStyle: 'italic' }}>
            Tap a bar to see details
          </Text>
        )}
      </View>

      {/* Chart with horizontal scroll */}
      <View style={{ flexDirection: 'row' }}>
        {/* Y-axis (fixed, doesn't scroll) */}
        <View style={{ width: Y_AXIS_W, marginRight: 6 }}>
          {/* Unit label inline at top */}
          <Text style={{
            fontSize: 8,
            color: theme.textSecondary,
            fontWeight: '600',
            textAlign: 'right',
            marginBottom: 2,
          }}>
            {unitLabel}
          </Text>
          <View style={{ height: chartHeight, justifyContent: 'space-between' }}>
            {yTicks.map((tick, i) => (
              <Text key={i} style={{
                fontSize: 9,
                color: theme.textSecondary,
                textAlign: 'right',
                lineHeight: 12,
                fontVariant: ['tabular-nums'],
              }}>
                {tick >= 1000 ? `${Math.round(tick / 1000)}k` : tick}
              </Text>
            ))}
          </View>
        </View>

        {/* Scrollable bar area */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          nestedScrollEnabled
        >
          <View style={{ flex: 1, minWidth: weeks.length * WEEK_MIN_W }}>
            {/* Grid lines */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: chartHeight + 14 }}>
              {yTicks.map((tick, i) => {
                const yPos = topTick > 0 ? ((topTick - tick) / topTick) * chartHeight : 0;
                return (
                  <View
                    key={`grid-${i}`}
                    style={{
                      position: 'absolute',
                      top: yPos + 14, // offset for unit label
                      left: 0,
                      right: 0,
                      height: 1,
                      backgroundColor: theme.border,
                      opacity: 0.3,
                    }}
                  />
                );
              })}
            </View>

            {/* Bars */}
            <View style={{ height: 14 }} />{/* spacer for unit label alignment */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: chartHeight }}>
              {weeks.map((weekData, weekIdx) => (
                <React.Fragment key={weekIdx}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', height: chartHeight, gap: 3, paddingHorizontal: 4 }}>
                    {weekData.map((day, dayIdx) => {
                      const isCurrentWeek = weekIdx === 2;
                      const vol = convert(day.volume);
                      const isPR = vol > 0 && vol === prConverted;
                      const isSelected = sel?.weekIdx === weekIdx && sel?.dayIdx === dayIdx;
                      const barHeight = topTick > 0
                        ? Math.max((vol / topTick) * chartHeight, vol > 0 ? 4 : 0)
                        : 0;

                      let barColor: string;
                      if (isSelected) {
                        barColor = highlight;
                      } else if (isPR && vol > 0) {
                        barColor = highlight;
                      } else if (isCurrentWeek) {
                        barColor = theme.text;
                      } else {
                        barColor = theme.textSecondary;
                      }

                      return (
                        <Pressable
                          key={dayIdx}
                          onPress={() => {
                            setSelectedBar(isSelected ? null : { weekIdx, dayIdx });
                          }}
                          style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: chartHeight }}
                        >
                          <View style={{
                            width: '75%',
                            height: barHeight,
                            backgroundColor: barColor,
                            borderRadius: 4,
                            opacity: isSelected ? 1 : isPR ? 0.9 : isCurrentWeek ? 0.8 : 0.35,
                          }} />
                        </Pressable>
                      );
                    })}
                  </View>
                  {/* Week separator */}
                  {weekIdx < weeks.length - 1 && (
                    <View style={{ width: 1, backgroundColor: theme.border, height: chartHeight, opacity: 0.5 }} />
                  )}
                </React.Fragment>
              ))}
            </View>

            {/* X-axis labels */}
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              {xLabels.map((label, idx) => (
                <React.Fragment key={idx}>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{
                      fontSize: 9,
                      fontWeight: idx === weeks.length - 1 ? '700' : '500',
                      color: idx === weeks.length - 1 ? theme.text : theme.textSecondary,
                    }}>
                      {label}
                    </Text>
                  </View>
                  {idx < xLabels.length - 1 && <View style={{ width: 1 }} />}
                </React.Fragment>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Legend */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: theme.textSecondary, opacity: 0.35 }} />
          <Text style={{ fontSize: 9, color: theme.textSecondary }}>Prev weeks</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: theme.text, opacity: 0.8 }} />
          <Text style={{ fontSize: 9, color: theme.textSecondary }}>This week</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: highlight }} />
          <Text style={{ fontSize: 9, color: theme.textSecondary }}>PR day</Text>
        </View>
      </View>
    </View>
  );
}
