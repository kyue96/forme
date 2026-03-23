import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Path,
  Circle,
  Ellipse,
  Line,
  Defs,
  RadialGradient,
  Stop,
  G,
  Rect,
  ClipPath,
} from 'react-native-svg';
import { useSettings } from '@/lib/settings-context';

interface MuscleInput {
  name: string;
  percentage: number;
}

interface BodyHeatmapProps {
  muscles: MuscleInput[];
  color?: string;
}

// Map common muscle names to body region keys
const MUSCLE_ALIASES: Record<string, string> = {
  chest: 'chest',
  pectorals: 'chest',
  pecs: 'chest',
  back: 'back',
  lats: 'back',
  traps: 'back',
  'upper back': 'back',
  'lower back': 'back',
  rhomboids: 'back',
  shoulders: 'shoulders',
  delts: 'shoulders',
  deltoids: 'shoulders',
  'front delts': 'shoulders',
  'rear delts': 'shoulders',
  'side delts': 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  core: 'core',
  abs: 'core',
  abdominals: 'core',
  obliques: 'core',
  quads: 'quads',
  quadriceps: 'quads',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  gluteus: 'glutes',
  calves: 'calves',
  calf: 'calves',
  forearms: 'biceps', // group with arms
};

function resolveRegion(name: string): string | null {
  const key = name.toLowerCase().trim();
  return MUSCLE_ALIASES[key] ?? null;
}

// SVG viewBox is 160x200
const SVG_WIDTH = 160;
const SVG_HEIGHT = 200;

// --- Body region paths (front-facing silhouette, simplified) ---

// Head
const HEAD_CX = 80;
const HEAD_CY = 20;
const HEAD_RX = 11;
const HEAD_RY = 13;

// Neck
const NECK = 'M74,33 L74,40 L86,40 L86,33';

// Torso outline
const TORSO_OUTLINE = 'M56,40 L52,44 L48,60 L48,80 L50,100 L55,105 L65,108 L80,110 L95,108 L105,105 L110,100 L112,80 L112,60 L108,44 L104,40 Z';

// --- Muscle region fill paths ---

// Chest: upper torso, two pec shapes
const CHEST_LEFT = 'M58,48 Q60,44 72,44 L78,44 L78,60 Q70,64 60,60 Z';
const CHEST_RIGHT = 'M102,48 Q100,44 88,44 L82,44 L82,60 Q90,64 100,60 Z';

// Shoulders: rounded caps on top of arms
const SHOULDER_LEFT = 'M56,40 Q46,40 44,50 L48,54 L56,48 Z';
const SHOULDER_RIGHT = 'M104,40 Q114,40 116,50 L112,54 L104,48 Z';

// Back region: shown as mid-torso band (since front view, we show it as upper-mid torso)
const BACK_REGION = 'M60,60 L100,60 L104,72 L108,80 L104,84 L56,84 L52,80 L56,72 Z';

// Core/Abs: lower torso
const CORE_REGION = 'M62,84 L98,84 L100,100 L96,106 L80,110 L64,106 L60,100 Z';

// Upper arms
const ARM_LEFT_UPPER = 'M44,50 L38,54 L32,72 L36,74 L44,72 L48,54 Z';
const ARM_RIGHT_UPPER = 'M116,50 L122,54 L128,72 L124,74 L116,72 L112,54 Z';

// Biceps fill (front of upper arm)
const BICEPS_LEFT = 'M42,54 L38,56 L33,70 L36,72 L44,70 L46,56 Z';
const BICEPS_RIGHT = 'M118,54 L122,56 L127,70 L124,72 L116,70 L114,56 Z';

// Triceps fill (back of upper arm - shown slightly offset)
const TRICEPS_LEFT = 'M38,54 L34,58 L30,70 L33,72 L38,70 L42,56 Z';
const TRICEPS_RIGHT = 'M122,54 L126,58 L130,70 L127,72 L122,70 L118,56 Z';

// Forearms
const FOREARM_LEFT = 'M32,74 L28,92 L30,96 L36,94 L38,76 Z';
const FOREARM_RIGHT = 'M128,74 L132,92 L130,96 L124,94 L122,76 Z';

// Hands (small)
const HAND_LEFT = 'M28,96 L26,104 L28,106 L32,104 L34,96 Z';
const HAND_RIGHT = 'M132,96 L134,104 L132,106 L128,104 L126,96 Z';

// Glutes: hip area
const GLUTES_REGION = 'M64,106 L96,106 L100,114 L94,118 L80,120 L66,118 L60,114 Z';

// Quads: upper front legs
const QUAD_LEFT = 'M60,114 L66,118 L76,120 L74,150 L68,152 L56,148 L52,130 Z';
const QUAD_RIGHT = 'M100,114 L94,118 L84,120 L86,150 L92,152 L104,148 L108,130 Z';

// Hamstrings: upper back legs (shown slightly behind quads)
const HAMSTRINGS_LEFT = 'M54,128 L60,118 L70,120 L68,148 L58,146 Z';
const HAMSTRINGS_RIGHT = 'M106,128 L100,118 L90,120 L92,148 L102,146 Z';

// Knees
const KNEE_LEFT_CX = 68;
const KNEE_LEFT_CY = 153;
const KNEE_RIGHT_CX = 92;
const KNEE_RIGHT_CY = 153;

// Calves: lower legs
const CALF_LEFT = 'M56,156 L66,155 L70,158 L68,180 L64,186 L56,184 L54,170 Z';
const CALF_RIGHT = 'M104,156 L94,155 L90,158 L92,180 L96,186 L104,184 L106,170 Z';

// Feet
const FOOT_LEFT = 'M54,184 L64,186 L66,192 L62,196 L52,194 L50,188 Z';
const FOOT_RIGHT = 'M106,184 L96,186 L94,192 L98,196 L108,194 L110,188 Z';

// Full body outline for the silhouette stroke
const BODY_OUTLINE = `
  M74,33 L74,40 L56,40 Q46,40 44,50 L38,54 L32,72 L28,92 L26,104 L28,106 L34,96 L36,76
  L44,72 L48,60 L48,80 L50,100 L55,105 L60,114 L52,130 L54,148 L56,156 L54,170 L54,184
  L50,188 L52,194 L62,196 L66,192 L64,186 L68,180 L70,158 L74,150 L80,120
  L86,150 L90,158 L92,180 L96,186 L94,192 L98,196 L108,194 L110,188 L106,184
  L106,170 L104,156 L102,148 L108,130 L100,114 L105,105 L110,100 L112,80 L112,60
  L116,72 L124,76 L126,96 L132,106 L134,104 L132,92 L128,72 L122,54 L116,50
  Q114,40 104,40 L86,40 L86,33
`;

// Region definitions for rendering
interface RegionDef {
  key: string;
  paths: string[];
}

const REGIONS: RegionDef[] = [
  { key: 'chest', paths: [CHEST_LEFT, CHEST_RIGHT] },
  { key: 'back', paths: [BACK_REGION] },
  { key: 'shoulders', paths: [SHOULDER_LEFT, SHOULDER_RIGHT] },
  { key: 'biceps', paths: [BICEPS_LEFT, BICEPS_RIGHT] },
  { key: 'triceps', paths: [TRICEPS_LEFT, TRICEPS_RIGHT] },
  { key: 'core', paths: [CORE_REGION] },
  { key: 'quads', paths: [QUAD_LEFT, QUAD_RIGHT] },
  { key: 'hamstrings', paths: [HAMSTRINGS_LEFT, HAMSTRINGS_RIGHT] },
  { key: 'glutes', paths: [GLUTES_REGION] },
  { key: 'calves', paths: [CALF_LEFT, CALF_RIGHT] },
];

// Parse hex color to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

export default function BodyHeatmap({ muscles, color = '#22C55E' }: BodyHeatmapProps) {
  const { theme } = useSettings();

  // Build a map of region -> percentage
  const regionMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of muscles) {
      const region = resolveRegion(m.name);
      if (region) {
        // Take the max if multiple inputs map to the same region
        map[region] = Math.max(map[region] ?? 0, Math.min(100, Math.max(0, m.percentage)));
      }
    }
    return map;
  }, [muscles]);

  const rgb = useMemo(() => hexToRgb(color), [color]);

  // Generate scanlines
  const scanlines = useMemo(() => {
    const lines: { y: number }[] = [];
    for (let y = 0; y < SVG_HEIGHT; y += 4) {
      lines.push({ y });
    }
    return lines;
  }, []);

  const isDark = theme.background === '#0A0A0A';
  const outlineColor = isDark
    ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`
    : `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`;
  const dimColor = isDark
    ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.04)`
    : `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.06)`;
  const bezelColor = isDark
    ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`
    : `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`;
  const bezelInnerGlow = isDark
    ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.06)`
    : `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`;
  const scanlineColor = isDark
    ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.04)`
    : `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.05)`;

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: bezelColor,
          backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.03)',
        },
      ]}
    >
      {/* Inner glow bezel */}
      <View
        style={[
          styles.innerGlow,
          { borderColor: bezelInnerGlow },
        ]}
      />

      <Svg
        width={SVG_WIDTH}
        height={SVG_HEIGHT}
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      >
        <Defs>
          <ClipPath id="bodyClip">
            <Path d={BODY_OUTLINE} />
            <Ellipse cx={HEAD_CX} cy={HEAD_CY} rx={HEAD_RX} ry={HEAD_RY} />
          </ClipPath>
          {/* Glow gradients for each active region */}
          {REGIONS.map((region) => {
            const pct = regionMap[region.key] ?? 0;
            if (pct <= 0) return null;
            return (
              <RadialGradient
                key={`grad-${region.key}`}
                id={`glow-${region.key}`}
                cx="50%"
                cy="50%"
                r="70%"
              >
                <Stop
                  offset="0%"
                  stopColor={color}
                  stopOpacity={0.15 + (pct / 100) * 0.65}
                />
                <Stop
                  offset="100%"
                  stopColor={color}
                  stopOpacity={0.05 + (pct / 100) * 0.2}
                />
              </RadialGradient>
            );
          })}
        </Defs>

        {/* Background fill for the body - very dim */}
        <Path d={BODY_OUTLINE} fill={dimColor} />
        <Ellipse cx={HEAD_CX} cy={HEAD_CY} rx={HEAD_RX} ry={HEAD_RY} fill={dimColor} />

        {/* Muscle region fills */}
        {REGIONS.map((region) => {
          const pct = regionMap[region.key] ?? 0;
          const isActive = pct > 0;

          return region.paths.map((path, i) => (
            <G key={`${region.key}-${i}`}>
              {/* Base fill */}
              <Path
                d={path}
                fill={
                  isActive
                    ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.1 + (pct / 100) * 0.55})`
                    : dimColor
                }
              />
              {/* Glow overlay for active regions */}
              {isActive && (
                <Path
                  d={path}
                  fill={`url(#glow-${region.key})`}
                />
              )}
            </G>
          ));
        })}

        {/* Body outline stroke */}
        <Path
          d={BODY_OUTLINE}
          fill="none"
          stroke={outlineColor}
          strokeWidth={1.2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Head outline */}
        <Ellipse
          cx={HEAD_CX}
          cy={HEAD_CY}
          rx={HEAD_RX}
          ry={HEAD_RY}
          fill="none"
          stroke={outlineColor}
          strokeWidth={1.2}
        />

        {/* Neck lines */}
        <Line x1={74} y1={33} x2={74} y2={40} stroke={outlineColor} strokeWidth={1} />
        <Line x1={86} y1={33} x2={86} y2={40} stroke={outlineColor} strokeWidth={1} />

        {/* Knee circles */}
        <Circle cx={KNEE_LEFT_CX} cy={KNEE_LEFT_CY} r={4} fill="none" stroke={outlineColor} strokeWidth={0.8} />
        <Circle cx={KNEE_RIGHT_CX} cy={KNEE_RIGHT_CY} r={4} fill="none" stroke={outlineColor} strokeWidth={0.8} />

        {/* Feet outlines */}
        <Path d={FOOT_LEFT} fill="none" stroke={outlineColor} strokeWidth={0.8} />
        <Path d={FOOT_RIGHT} fill="none" stroke={outlineColor} strokeWidth={0.8} />

        {/* Hand outlines */}
        <Path d={HAND_LEFT} fill="none" stroke={outlineColor} strokeWidth={0.8} />
        <Path d={HAND_RIGHT} fill="none" stroke={outlineColor} strokeWidth={0.8} />

        {/* Forearm outlines */}
        <Path d={FOREARM_LEFT} fill="none" stroke={outlineColor} strokeWidth={0.8} />
        <Path d={FOREARM_RIGHT} fill="none" stroke={outlineColor} strokeWidth={0.8} />

        {/* Internal region dividers - subtle lines to show muscle groups */}
        {/* Chest division */}
        <Line x1={80} y1={44} x2={80} y2={62} stroke={outlineColor} strokeWidth={0.5} opacity={0.5} />
        {/* Core horizontal lines (ab segments) */}
        <Line x1={64} y1={88} x2={96} y2={88} stroke={outlineColor} strokeWidth={0.4} opacity={0.4} />
        <Line x1={62} y1={94} x2={98} y2={94} stroke={outlineColor} strokeWidth={0.4} opacity={0.4} />
        <Line x1={62} y1={100} x2={98} y2={100} stroke={outlineColor} strokeWidth={0.4} opacity={0.4} />
        {/* Core center line */}
        <Line x1={80} y1={84} x2={80} y2={108} stroke={outlineColor} strokeWidth={0.4} opacity={0.4} />

        {/* Scanlines for CRT effect */}
        {scanlines.map((line, i) => (
          <Line
            key={`scan-${i}`}
            x1={0}
            y1={line.y}
            x2={SVG_WIDTH}
            y2={line.y}
            stroke={scanlineColor}
            strokeWidth={1}
          />
        ))}

        {/* Corner tick marks for diagnostic screen feel */}
        {/* Top-left */}
        <Line x1={2} y1={6} x2={2} y2={2} stroke={outlineColor} strokeWidth={0.8} opacity={0.6} />
        <Line x1={2} y1={2} x2={6} y2={2} stroke={outlineColor} strokeWidth={0.8} opacity={0.6} />
        {/* Top-right */}
        <Line x1={154} y1={2} x2={158} y2={2} stroke={outlineColor} strokeWidth={0.8} opacity={0.6} />
        <Line x1={158} y1={2} x2={158} y2={6} stroke={outlineColor} strokeWidth={0.8} opacity={0.6} />
        {/* Bottom-left */}
        <Line x1={2} y1={194} x2={2} y2={198} stroke={outlineColor} strokeWidth={0.8} opacity={0.6} />
        <Line x1={2} y1={198} x2={6} y2={198} stroke={outlineColor} strokeWidth={0.8} opacity={0.6} />
        {/* Bottom-right */}
        <Line x1={154} y1={198} x2={158} y2={198} stroke={outlineColor} strokeWidth={0.8} opacity={0.6} />
        <Line x1={158} y1={194} x2={158} y2={198} stroke={outlineColor} strokeWidth={0.8} opacity={0.6} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 180,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  innerGlow: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderRadius: 5,
    margin: 2,
  },
});
