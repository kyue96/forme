import React, { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { View, PanResponder, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

interface ColorWheelProps {
  size?: number;
  currentColor: string;
  onColorSelect: (color: string) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

// --- Color conversion helpers ---

function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let r = 0, g = 0, b = 0;

  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else               { r = c; g = 0; b = x; }

  const toHex = (v: number) => {
    const hex = Math.round((v + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const clean = hex.replace('#', '');
  if (clean.length < 6) return { h: 0, s: 100, l: 50 };
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }

  return { h, s: s * 100, l: l * 100 };
}

// Use fewer segments for performance — 72 is smooth enough visually
const SEGMENT_COUNT = 72;
const LIGHTNESS = 50;

export default function ColorWheel({
  size = 200,
  currentColor,
  onColorSelect,
  onInteractionStart,
  onInteractionEnd,
}: ColorWheelProps) {
  const layoutRef = useRef<{ x: number; y: number } | null>(null);
  const viewRef = useRef<View>(null);
  const radius = size / 2;
  const indicatorRadius = 10;

  // Track indicator position locally for smooth dragging
  const [localColor, setLocalColor] = useState(currentColor);
  const isDragging = useRef(false);
  const lastCallTime = useRef(0);

  // Sync from parent when not dragging
  useEffect(() => {
    if (!isDragging.current) {
      setLocalColor(currentColor);
    }
  }, [currentColor]);

  // Static wheel segments — only recompute on size change
  const segments = useMemo(() => {
    const segs: { d: string; fill: string }[] = [];
    const angleStep = (2 * Math.PI) / SEGMENT_COUNT;
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const a1 = i * angleStep - Math.PI / 2;
      const a2 = (i + 1) * angleStep - Math.PI / 2;
      const x1 = radius + radius * Math.cos(a1);
      const y1 = radius + radius * Math.sin(a1);
      const x2 = radius + radius * Math.cos(a2);
      const y2 = radius + radius * Math.sin(a2);
      const d = `M ${radius} ${radius} L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} Z`;
      const hue = (i / SEGMENT_COUNT) * 360;
      segs.push({ d, fill: hslToHex(hue, 100, LIGHTNESS) });
    }
    return segs;
  }, [size, radius]);

  // Indicator position from localColor
  const indicator = useMemo(() => {
    const { h, s } = hexToHsl(localColor);
    const angle = ((h / 360) * 2 * Math.PI) - Math.PI / 2;
    const dist = (s / 100) * (radius - indicatorRadius);
    return {
      x: radius + dist * Math.cos(angle),
      y: radius + dist * Math.sin(angle),
    };
  }, [localColor, radius]);

  const handleTouch = useCallback(
    (pageX: number, pageY: number) => {
      if (!layoutRef.current) return;
      const { x: lx, y: ly } = layoutRef.current;
      const dx = pageX - lx - radius;
      const dy = pageY - ly - radius;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) return;

      let angle = Math.atan2(dy, dx) + Math.PI / 2;
      if (angle < 0) angle += 2 * Math.PI;
      const hue = (angle / (2 * Math.PI)) * 360;
      const saturation = Math.min((dist / (radius - indicatorRadius)) * 100, 100);
      const hex = hslToHex(hue, saturation, LIGHTNESS);

      // Update local state immediately for smooth indicator
      setLocalColor(hex);

      // Throttle parent callback to every 50ms
      const now = Date.now();
      if (now - lastCallTime.current > 50) {
        lastCallTime.current = now;
        onColorSelect(hex);
      }
    },
    [radius, onColorSelect],
  );

  // Measure position eagerly on layout
  const onLayout = useCallback(() => {
    viewRef.current?.measureInWindow((x, y) => {
      layoutRef.current = { x, y };
    });
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (evt) => {
          isDragging.current = true;
          onInteractionStart?.();
          // Re-measure in case scroll changed position
          viewRef.current?.measureInWindow((x, y) => {
            layoutRef.current = { x, y };
            handleTouch(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
          });
        },
        onPanResponderMove: (evt) => {
          handleTouch(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
        },
        onPanResponderRelease: () => {
          isDragging.current = false;
          // Send final color to parent
          onColorSelect(localColor);
          onInteractionEnd?.();
        },
        onPanResponderTerminate: () => {
          isDragging.current = false;
          onColorSelect(localColor);
          onInteractionEnd?.();
        },
      }),
    [handleTouch, onInteractionStart, onInteractionEnd, onColorSelect, localColor],
  );

  const previewRadius = radius * 0.2;

  return (
    <View
      ref={viewRef}
      onLayout={onLayout}
      style={[styles.container, { width: size, height: size }]}
      {...panResponder.panHandlers}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Hue wheel — static, never re-renders */}
        {segments.map((seg, i) => (
          <Path key={i} d={seg.d} fill={seg.fill} />
        ))}

        {/* White-to-transparent radial overlay for saturation */}
        <Defs>
          <RadialGradient id="satGrad" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="white" stopOpacity={0.9} />
            <Stop offset="60%" stopColor="white" stopOpacity={0.3} />
            <Stop offset="100%" stopColor="white" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={radius} cy={radius} r={radius} fill="url(#satGrad)" />

        {/* Center preview */}
        <Circle
          cx={radius}
          cy={radius}
          r={previewRadius}
          fill={localColor}
          stroke="white"
          strokeWidth={2}
        />

        {/* Selection indicator */}
        <Circle
          cx={indicator.x}
          cy={indicator.y}
          r={indicatorRadius}
          fill={localColor}
          stroke="white"
          strokeWidth={3}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
  },
});
