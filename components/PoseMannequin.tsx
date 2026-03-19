import Svg, { Circle, Path, G, Ellipse } from 'react-native-svg';

/**
 * Joint angles define limb rotations in degrees from vertical (0 = straight down).
 * Positive = clockwise, Negative = counter-clockwise.
 */
export interface PoseAngles {
  leftShoulder: number;
  leftElbow: number;
  rightShoulder: number;
  rightElbow: number;
  leftHip: number;
  leftKnee: number;
  rightHip: number;
  rightKnee: number;
  torsoLean: number;
}

interface PoseMannequinProps {
  pose: PoseAngles;
  size?: number;
  color?: string;
  fillColor?: string;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

function ep(x: number, y: number, angleDeg: number, length: number): [number, number] {
  const a = rad(angleDeg);
  return [x + Math.sin(a) * length, y + Math.cos(a) * length];
}

// Build a tapered limb path (wider at origin, narrower at end)
function limbPath(
  x1: number, y1: number, x2: number, y2: number,
  w1: number, w2: number,
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  // Perpendicular unit vector
  const px = -dy / len;
  const py = dx / len;

  const ax = x1 + px * w1, ay = y1 + py * w1;
  const bx = x1 - px * w1, by = y1 - py * w1;
  const cx = x2 - px * w2, cy = y2 - py * w2;
  const ddx = x2 + px * w2, ddy = y2 + py * w2;

  return `M${ax},${ay} L${ddx},${ddy} Q${x2},${y2 + w2 * 0.3} ${cx},${cy} L${bx},${by} Q${x1},${y1 - w1 * 0.3} ${ax},${ay} Z`;
}

// Torso as a tapered shape (shoulders wider, waist narrower)
function torsoPath(
  sx: number, sy: number, hx: number, hy: number,
  shoulderW: number, waistW: number,
): string {
  const dx = hx - sx;
  const dy = hy - sy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const px = -dy / len;
  const py = dx / len;

  const ls = { x: sx + px * shoulderW, y: sy + py * shoulderW };
  const rs = { x: sx - px * shoulderW, y: sy - py * shoulderW };
  const lh = { x: hx + px * waistW, y: hy + py * waistW };
  const rh = { x: hx - px * waistW, y: hy - py * waistW };

  // Slight curve for natural body shape
  const midY = (sy + hy) / 2;
  const chestBulge = shoulderW * 0.15;

  return `M${ls.x},${ls.y} `
    + `Q${ls.x + chestBulge},${midY} ${lh.x},${lh.y} `
    + `L${rh.x},${rh.y} `
    + `Q${rs.x - chestBulge},${midY} ${rs.x},${rs.y} Z`;
}

/**
 * Body-outline mannequin with tapered limbs and proper torso shape.
 * Minimal, clean silhouette aesthetic.
 */
export function PoseMannequin({ pose, size = 120, color = '#888', fillColor }: PoseMannequinProps) {
  const fill = fillColor || color;
  const opacity = fillColor ? 1 : 0.15;
  const sw = 1.8;

  // Body proportions (120x120 viewbox)
  const headR = 7;
  const neckLen = 3;
  const torsoLen = 26;
  const upperArmLen = 16;
  const forearmLen = 14;
  const thighLen = 20;
  const shinLen = 18;

  // Limb widths (tapered)
  const upperArmW1 = 3.5, upperArmW2 = 2.8;
  const forearmW1 = 2.8, forearmW2 = 2;
  const thighW1 = 5, thighW2 = 3.5;
  const shinW1 = 3.5, shinW2 = 2.2;
  const shoulderW = 9;
  const waistW = 6;

  // Positions
  const headX = 60, headY = 16;
  const neckX = headX + Math.sin(rad(pose.torsoLean)) * neckLen;
  const neckY = headY + headR + neckLen;
  const [hipX, hipY] = ep(neckX, neckY, pose.torsoLean, torsoLen);
  const shY = neckY + 1;
  const shX = neckX + Math.sin(rad(pose.torsoLean)) * 1;

  // Arms
  const [leX, leY] = ep(shX, shY, pose.leftShoulder, upperArmLen);
  const [lhX, lhY] = ep(leX, leY, pose.leftShoulder + pose.leftElbow, forearmLen);
  const [reX, reY] = ep(shX, shY, pose.rightShoulder, upperArmLen);
  const [rhX, rhY] = ep(reX, reY, pose.rightShoulder + pose.rightElbow, forearmLen);

  // Legs
  const [lkX, lkY] = ep(hipX, hipY, pose.leftHip, thighLen);
  const [lfX, lfY] = ep(lkX, lkY, pose.leftHip + pose.leftKnee, shinLen);
  const [rkX, rkY] = ep(hipX, hipY, pose.rightHip, thighLen);
  const [rfX, rfY] = ep(rkX, rkY, pose.rightHip + pose.rightKnee, shinLen);

  // Hand circles
  const handR = 2.2;
  // Foot ellipses
  const footRx = 3, footRy = 1.8;

  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <G>
        {/* Back leg (right) - drawn first so it's behind torso */}
        <Path d={limbPath(hipX, hipY, rkX, rkY, thighW1, thighW2)} fill={fill} fillOpacity={opacity} stroke={color} strokeWidth={sw} />
        <Path d={limbPath(rkX, rkY, rfX, rfY, shinW1, shinW2)} fill={fill} fillOpacity={opacity} stroke={color} strokeWidth={sw} />
        <Ellipse cx={rfX} cy={rfY} rx={footRx} ry={footRy} fill={fill} fillOpacity={opacity} stroke={color} strokeWidth={sw} />

        {/* Back arm (right) */}
        <Path d={limbPath(shX, shY, reX, reY, upperArmW1, upperArmW2)} fill={fill} fillOpacity={opacity} stroke={color} strokeWidth={sw} />
        <Path d={limbPath(reX, reY, rhX, rhY, forearmW1, forearmW2)} fill={fill} fillOpacity={opacity} stroke={color} strokeWidth={sw} />
        <Circle cx={rhX} cy={rhY} r={handR} fill={fill} fillOpacity={opacity} stroke={color} strokeWidth={sw} />

        {/* Torso */}
        <Path d={torsoPath(shX, shY, hipX, hipY, shoulderW, waistW)} fill={fill} fillOpacity={opacity} stroke={color} strokeWidth={sw} />

        {/* Neck */}
        <Path d={limbPath(headX, headY + headR, neckX, neckY, 2.5, 3)} fill={fill} fillOpacity={opacity} stroke={color} strokeWidth={sw} />

        {/* Head */}
        <Circle cx={headX} cy={headY} r={headR} fill={fill} fillOpacity={opacity} stroke={color} strokeWidth={sw} />

        {/* Front leg (left) */}
        <Path d={limbPath(hipX, hipY, lkX, lkY, thighW1, thighW2)} fill={fill} fillOpacity={opacity} stroke={color} strokeWidth={sw} />
        <Path d={limbPath(lkX, lkY, lfX, lfY, shinW1, shinW2)} fill={fill} fillOpacity={opacity} stroke={color} strokeWidth={sw} />
        <Ellipse cx={lfX} cy={lfY} rx={footRx} ry={footRy} fill={fill} fillOpacity={opacity} stroke={color} strokeWidth={sw} />

        {/* Front arm (left) */}
        <Path d={limbPath(shX, shY, leX, leY, upperArmW1, upperArmW2)} fill={fill} fillOpacity={opacity} stroke={color} strokeWidth={sw} />
        <Path d={limbPath(leX, leY, lhX, lhY, forearmW1, forearmW2)} fill={fill} fillOpacity={opacity} stroke={color} strokeWidth={sw} />
        <Circle cx={lhX} cy={lhY} r={handR} fill={fill} fillOpacity={opacity} stroke={color} strokeWidth={sw} />
      </G>
    </Svg>
  );
}

// ── Default standing pose ──
export const STANDING: PoseAngles = {
  leftShoulder: -15, leftElbow: 0,
  rightShoulder: 15, rightElbow: 0,
  leftHip: -5, leftKnee: 0,
  rightHip: 5, rightKnee: 0,
  torsoLean: 0,
};
