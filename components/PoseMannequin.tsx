import Svg, { Circle, Line, G } from 'react-native-svg';

/**
 * Joint angles define limb rotations in degrees from vertical (0 = straight down).
 * Positive = clockwise, Negative = counter-clockwise.
 */
export interface PoseAngles {
  // Upper body
  leftShoulder: number;   // angle of upper arm from torso
  leftElbow: number;      // angle of forearm from upper arm
  rightShoulder: number;
  rightElbow: number;
  // Lower body
  leftHip: number;        // angle of thigh from torso
  leftKnee: number;       // angle of shin from thigh
  rightHip: number;
  rightKnee: number;
  // Torso
  torsoLean: number;      // forward/back lean in degrees (0 = upright)
}

interface PoseMannequinProps {
  pose: PoseAngles;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

// Convert degrees to radians
const rad = (deg: number) => (deg * Math.PI) / 180;

// Calculate endpoint from origin, angle (from vertical), and length
function endpoint(x: number, y: number, angleDeg: number, length: number): [number, number] {
  // 0 degrees = straight down, positive = clockwise
  const a = rad(angleDeg);
  return [x + Math.sin(a) * length, y + Math.cos(a) * length];
}

/**
 * Minimal poseable stick-figure mannequin rendered as SVG.
 * Uses joint angles to position limbs. Clean, geometric aesthetic.
 */
export function PoseMannequin({ pose, size = 120, color = '#666', strokeWidth = 2.5 }: PoseMannequinProps) {
  const scale = size / 120;
  const s = (v: number) => v * scale;

  // Body proportions (in a 120x120 viewbox)
  const headRadius = 6;
  const neckLen = 4;
  const torsoLen = 28;
  const upperArmLen = 18;
  const forearmLen = 16;
  const thighLen = 22;
  const shinLen = 20;

  // Head center
  const headX = 60;
  const headY = 18;

  // Neck base
  const neckX = headX + Math.sin(rad(pose.torsoLean)) * neckLen;
  const neckY = headY + headRadius + neckLen;

  // Hip center (bottom of torso)
  const [hipX, hipY] = endpoint(neckX, neckY, pose.torsoLean, torsoLen);

  // Shoulder point (slightly below neck)
  const shoulderY = neckY + 2;
  const shoulderX = neckX + Math.sin(rad(pose.torsoLean)) * 2;

  // Left arm
  const [lElbowX, lElbowY] = endpoint(shoulderX, shoulderY, pose.leftShoulder, upperArmLen);
  const [lHandX, lHandY] = endpoint(lElbowX, lElbowY, pose.leftShoulder + pose.leftElbow, forearmLen);

  // Right arm
  const [rElbowX, rElbowY] = endpoint(shoulderX, shoulderY, pose.rightShoulder, upperArmLen);
  const [rHandX, rHandY] = endpoint(rElbowX, rElbowY, pose.rightShoulder + pose.rightElbow, forearmLen);

  // Left leg
  const [lKneeX, lKneeY] = endpoint(hipX, hipY, pose.leftHip, thighLen);
  const [lFootX, lFootY] = endpoint(lKneeX, lKneeY, pose.leftHip + pose.leftKnee, shinLen);

  // Right leg
  const [rKneeX, rKneeY] = endpoint(hipX, hipY, pose.rightHip, thighLen);
  const [rFootX, rFootY] = endpoint(rKneeX, rKneeY, pose.rightHip + pose.rightKnee, shinLen);

  const lw = strokeWidth;
  const jointR = 2.5 * scale;

  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <G>
        {/* Head */}
        <Circle cx={headX} cy={headY} r={headRadius} fill="none" stroke={color} strokeWidth={lw} />

        {/* Neck */}
        <Line x1={headX} y1={headY + headRadius} x2={neckX} y2={neckY} stroke={color} strokeWidth={lw} strokeLinecap="round" />

        {/* Torso */}
        <Line x1={neckX} y1={neckY} x2={hipX} y2={hipY} stroke={color} strokeWidth={lw} strokeLinecap="round" />

        {/* Left arm */}
        <Line x1={shoulderX} y1={shoulderY} x2={lElbowX} y2={lElbowY} stroke={color} strokeWidth={lw} strokeLinecap="round" />
        <Line x1={lElbowX} y1={lElbowY} x2={lHandX} y2={lHandY} stroke={color} strokeWidth={lw} strokeLinecap="round" />
        <Circle cx={lElbowX} cy={lElbowY} r={jointR} fill={color} />

        {/* Right arm */}
        <Line x1={shoulderX} y1={shoulderY} x2={rElbowX} y2={rElbowY} stroke={color} strokeWidth={lw} strokeLinecap="round" />
        <Line x1={rElbowX} y1={rElbowY} x2={rHandX} y2={rHandY} stroke={color} strokeWidth={lw} strokeLinecap="round" />
        <Circle cx={rElbowX} cy={rElbowY} r={jointR} fill={color} />

        {/* Left leg */}
        <Line x1={hipX} y1={hipY} x2={lKneeX} y2={lKneeY} stroke={color} strokeWidth={lw} strokeLinecap="round" />
        <Line x1={lKneeX} y1={lKneeY} x2={lFootX} y2={lFootY} stroke={color} strokeWidth={lw} strokeLinecap="round" />
        <Circle cx={lKneeX} cy={lKneeY} r={jointR} fill={color} />

        {/* Right leg */}
        <Line x1={hipX} y1={hipY} x2={rKneeX} y2={rKneeY} stroke={color} strokeWidth={lw} strokeLinecap="round" />
        <Line x1={rKneeX} y1={rKneeY} x2={rFootX} y2={rFootY} stroke={color} strokeWidth={lw} strokeLinecap="round" />
        <Circle cx={rKneeX} cy={rKneeY} r={jointR} fill={color} />

        {/* Shoulder joint */}
        <Circle cx={shoulderX} cy={shoulderY} r={jointR} fill={color} />

        {/* Hip joint */}
        <Circle cx={hipX} cy={hipY} r={jointR} fill={color} />
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
