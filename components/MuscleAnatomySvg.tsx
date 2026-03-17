import React from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Path, G, Ellipse, Rect, Circle } from 'react-native-svg';

interface MuscleAnatomySvgProps {
  highlighted: string | null;
  onPress: (muscle: string) => void;
  size?: number;
}

interface MuscleRegion {
  name: string;
  type: 'ellipse' | 'rect' | 'path';
  props: Record<string, string | number>;
}

const DEFAULT_FILL = '#E5E7EB';
const HIGHLIGHTED_FILL = '#22C55E';
const OUTLINE_COLOR = '#9CA3AF';

const VIEWBOX_WIDTH = 200;
const VIEWBOX_HEIGHT = 360;

const MUSCLE_REGIONS: MuscleRegion[] = [
  // Chest — two rounded rects across upper torso
  {
    name: 'Chest',
    type: 'path',
    props: {
      d: 'M70,105 Q75,95 100,95 Q125,95 130,105 L130,130 Q125,138 100,140 Q75,138 70,130 Z',
    },
  },
  // Shoulders — left
  {
    name: 'Shoulders',
    type: 'path',
    props: {
      d: 'M55,90 Q50,85 48,95 L48,115 Q50,120 58,118 L65,105 Q65,95 55,90 Z',
    },
  },
  // Shoulders — right (mirrored)
  {
    name: 'Shoulders',
    type: 'path',
    props: {
      d: 'M145,90 Q150,85 152,95 L152,115 Q150,120 142,118 L135,105 Q135,95 145,90 Z',
    },
  },
  // Arms — left upper arm
  {
    name: 'Arms',
    type: 'path',
    props: {
      d: 'M45,118 L38,170 Q37,178 43,178 L55,178 Q60,178 58,170 L58,118 Z',
    },
  },
  // Arms — right upper arm
  {
    name: 'Arms',
    type: 'path',
    props: {
      d: 'M155,118 L162,170 Q163,178 157,178 L145,178 Q140,178 142,170 L142,118 Z',
    },
  },
  // Arms — left forearm
  {
    name: 'Arms',
    type: 'path',
    props: {
      d: 'M36,180 L30,230 Q29,236 35,236 L47,236 Q52,236 50,230 L46,180 Z',
    },
  },
  // Arms — right forearm
  {
    name: 'Arms',
    type: 'path',
    props: {
      d: 'M164,180 L170,230 Q171,236 165,236 L153,236 Q148,236 150,230 L154,180 Z',
    },
  },
  // Core / Abs
  {
    name: 'Core',
    type: 'path',
    props: {
      d: 'M78,142 Q80,140 100,140 Q120,140 122,142 L122,195 Q120,200 100,202 Q80,200 78,195 Z',
    },
  },
  // Back — shown as two strips along the sides of the torso (visible from front as lats)
  {
    name: 'Back',
    type: 'path',
    props: {
      d: 'M62,108 L60,115 L62,170 Q65,175 70,170 L70,130 L68,108 Z',
    },
  },
  {
    name: 'Back',
    type: 'path',
    props: {
      d: 'M138,108 L140,115 L138,170 Q135,175 130,170 L130,130 L132,108 Z',
    },
  },
  // Legs — left thigh
  {
    name: 'Legs',
    type: 'path',
    props: {
      d: 'M75,205 L70,280 Q69,288 78,288 L95,288 Q100,288 99,280 L100,205 Z',
    },
  },
  // Legs — right thigh
  {
    name: 'Legs',
    type: 'path',
    props: {
      d: 'M125,205 L130,280 Q131,288 122,288 L105,288 Q100,288 101,280 L100,205 Z',
    },
  },
  // Legs — left shin
  {
    name: 'Legs',
    type: 'path',
    props: {
      d: 'M72,292 L70,345 Q70,352 78,352 L92,352 Q98,352 97,345 L95,292 Z',
    },
  },
  // Legs — right shin
  {
    name: 'Legs',
    type: 'path',
    props: {
      d: 'M128,292 L130,345 Q130,352 122,352 L108,352 Q102,352 103,345 L105,292 Z',
    },
  },
];

export default function MuscleAnatomySvg({
  highlighted,
  onPress,
  size = 200,
}: MuscleAnatomySvgProps) {
  const scale = size / VIEWBOX_WIDTH;
  const height = VIEWBOX_HEIGHT * scale;

  const getFill = (name: string) =>
    highlighted === name ? HIGHLIGHTED_FILL : DEFAULT_FILL;

  // Group regions by name so we can wrap them in a single Pressable per group
  const regionsByName = MUSCLE_REGIONS.reduce<Record<string, MuscleRegion[]>>(
    (acc, region) => {
      if (!acc[region.name]) acc[region.name] = [];
      acc[region.name].push(region);
      return acc;
    },
    {},
  );

  return (
    <View style={{ width: size, height }}>
      <Svg
        width={size}
        height={height}
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      >
        {/* Head */}
        <Circle cx={100} cy={55} r={25} fill="#F3F4F6" stroke={OUTLINE_COLOR} strokeWidth={1.5} />

        {/* Neck */}
        <Rect x={92} y={78} width={16} height={16} rx={4} fill="#F3F4F6" stroke={OUTLINE_COLOR} strokeWidth={1} />

        {/* Body outline (behind muscle regions) */}
        <Path
          d="M60,90 Q50,88 48,95 L36,180 L28,236 Q27,240 32,240 L50,240 L46,180 L58,118 L62,170 Q65,200 75,205 L70,280 L68,292 L70,352 Q70,358 80,358 L92,358 Q100,358 98,352 L95,292 L95,288 L100,205 L100,205 L105,288 L105,292 L103,352 Q102,358 108,358 L122,358 Q130,358 130,352 L128,292 L130,280 L125,205 Q135,200 138,170 L142,118 L154,180 L150,240 L168,240 Q173,240 172,236 L164,180 L152,95 Q150,88 140,90 Q130,88 100,88 Q70,88 60,90 Z"
          fill="none"
          stroke={OUTLINE_COLOR}
          strokeWidth={1.5}
        />

        {/* Muscle regions */}
        {Object.entries(regionsByName).map(([name, regions]) => (
          <G key={name} onPress={() => onPress(name)}>
            {regions.map((region, idx) => {
              const fill = getFill(name);
              const key = `${name}-${idx}`;
              if (region.type === 'path') {
                return (
                  <Path
                    key={key}
                    d={region.props.d as string}
                    fill={fill}
                    stroke={OUTLINE_COLOR}
                    strokeWidth={1}
                    opacity={0.85}
                  />
                );
              }
              if (region.type === 'ellipse') {
                return (
                  <Ellipse
                    key={key}
                    cx={region.props.cx as number}
                    cy={region.props.cy as number}
                    rx={region.props.rx as number}
                    ry={region.props.ry as number}
                    fill={fill}
                    stroke={OUTLINE_COLOR}
                    strokeWidth={1}
                    opacity={0.85}
                  />
                );
              }
              if (region.type === 'rect') {
                return (
                  <Rect
                    key={key}
                    x={region.props.x as number}
                    y={region.props.y as number}
                    width={region.props.width as number}
                    height={region.props.height as number}
                    rx={region.props.rx as number}
                    fill={fill}
                    stroke={OUTLINE_COLOR}
                    strokeWidth={1}
                    opacity={0.85}
                  />
                );
              }
              return null;
            })}
          </G>
        ))}
      </Svg>

      {/* Pressable overlay regions for touch handling */}
      {Object.entries(regionsByName).map(([name]) => {
        // Compute a bounding box for each muscle group for the pressable overlay
        const bounds = getBounds(regionsByName[name]);
        return (
          <Pressable
            key={`press-${name}`}
            onPress={() => onPress(name)}
            style={{
              position: 'absolute',
              left: bounds.minX * scale,
              top: bounds.minY * scale,
              width: (bounds.maxX - bounds.minX) * scale,
              height: (bounds.maxY - bounds.minY) * scale,
            }}
          />
        );
      })}
    </View>
  );
}

/** Parse simple numeric values from path data to estimate bounding box */
function getBounds(regions: MuscleRegion[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const region of regions) {
    if (region.type === 'path') {
      const d = region.props.d as string;
      // Extract all number pairs from the path
      const nums = d.match(/-?\d+\.?\d*/g);
      if (nums) {
        for (let i = 0; i < nums.length - 1; i += 2) {
          const x = parseFloat(nums[i]);
          const y = parseFloat(nums[i + 1]);
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    } else if (region.type === 'ellipse') {
      const cx = region.props.cx as number;
      const cy = region.props.cy as number;
      const rx = region.props.rx as number;
      const ry = region.props.ry as number;
      minX = Math.min(minX, cx - rx);
      minY = Math.min(minY, cy - ry);
      maxX = Math.max(maxX, cx + rx);
      maxY = Math.max(maxY, cy + ry);
    } else if (region.type === 'rect') {
      const x = region.props.x as number;
      const y = region.props.y as number;
      const w = region.props.width as number;
      const h = region.props.height as number;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }
  }

  return { minX, minY, maxX, maxY };
}
