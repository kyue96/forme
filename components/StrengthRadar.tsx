import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import Svg, { Polygon, Line, Circle, Text as SvgText } from 'react-native-svg';

interface RadarAxis {
  label: string;
  value: number; // 0-1 normalized
  raw: number;   // actual volume
}

interface StrengthRadarProps {
  data: RadarAxis[];
  size?: number;
  accentColor?: string;
  theme: {
    surface: string;
    border: string;
    text: string;
    textSecondary: string;
    background: string;
  };
}

/**
 * Convert raw muscle distribution directly into radar axes.
 * Each muscle category becomes its own axis. Normalized 0-1.
 */
export function groupForRadar(
  muscleData: { category: string; volume: number; pct?: number }[]
): RadarAxis[] {
  // Use the raw categories directly — filter out zero-volume ones
  const nonZero = muscleData.filter((m) => m.volume > 0);
  if (nonZero.length < 3) return [];

  const maxVal = Math.max(...nonZero.map((m) => m.volume), 1);

  return nonZero.map((m) => ({
    label: m.category,
    value: m.volume / maxVal,
    raw: m.volume,
  }));
}

export function StrengthRadar({ data, size = 280, accentColor = '#F59E0B', theme }: StrengthRadarProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  if (data.length < 3) return null;

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.33;
  const n = data.length;
  const rings = 4;

  // Dynamic label radius — more room when there are many axes
  const labelRadius = radius + (n > 7 ? 28 : 24);

  const getPoint = (index: number, dist: number): [number, number] => {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
    return [
      cx + radius * dist * Math.cos(angle),
      cy + radius * dist * Math.sin(angle),
    ];
  };

  // Grid ring polygons
  const gridRings = Array.from({ length: rings }, (_, ringIdx) => {
    const dist = (ringIdx + 1) / rings;
    return Array.from({ length: n }, (_, i) => getPoint(i, dist).join(',')).join(' ');
  });

  // Data polygon
  const dataPoints = data.map((d, i) => {
    const val = Math.max(d.value * 0.85 + 0.15, 0.15);
    return getPoint(i, val);
  });
  const dataPolygonPoints = dataPoints.map((p) => p.join(',')).join(' ');

  // Axis lines
  const axisLines = Array.from({ length: n }, (_, i) => {
    const [x, y] = getPoint(i, 1);
    return { x1: cx, y1: cy, x2: x, y2: y };
  });

  // Label positions
  const labels = data.map((d, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const x = cx + labelRadius * Math.cos(angle);
    const y = cy + labelRadius * Math.sin(angle);
    let textAnchor: 'start' | 'middle' | 'end' = 'middle';
    if (Math.cos(angle) > 0.3) textAnchor = 'start';
    else if (Math.cos(angle) < -0.3) textAnchor = 'end';
    let dy = 0;
    if (Math.sin(angle) > 0.3) dy = 4;
    else if (Math.sin(angle) < -0.3) dy = -2;
    return { x, y, textAnchor, dy, label: d.label, value: d.value };
  });

  return (
    <View style={{ alignItems: 'center', paddingVertical: 4 }}>
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        }}
      >
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Grid rings */}
          {gridRings.map((points, i) => (
            <Polygon
              key={`ring-${i}`}
              points={points}
              fill="none"
              stroke={theme.border}
              strokeWidth={i === rings - 1 ? 1 : 0.5}
              opacity={0.5}
            />
          ))}

          {/* Axis lines */}
          {axisLines.map((line, i) => (
            <Line
              key={`axis-${i}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={theme.border}
              strokeWidth={0.5}
              opacity={0.4}
            />
          ))}

          {/* Data fill */}
          <Polygon
            points={dataPolygonPoints}
            fill={accentColor}
            fillOpacity={0.15}
            stroke={accentColor}
            strokeWidth={1.5}
            strokeOpacity={0.8}
          />

          {/* Data dots */}
          {dataPoints.map(([x, y], i) => (
            <Circle
              key={`dot-${i}`}
              cx={x}
              cy={y}
              r={3.5}
              fill={accentColor}
              stroke={theme.surface}
              strokeWidth={1.5}
            />
          ))}

          {/* Labels */}
          {labels.map((l, i) => (
            <SvgText
              key={`label-${i}`}
              x={l.x}
              y={l.y + l.dy}
              textAnchor={l.textAnchor}
              fill={l.value > 0.5 ? theme.text : theme.textSecondary}
              fontSize={11}
              fontWeight={l.value > 0.5 ? '600' : '400'}
            >
              {l.label}
            </SvgText>
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
}
