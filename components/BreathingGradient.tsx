import React, { useEffect, useRef } from 'react';
import { Animated, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface BreathingGradientProps {
  color: string;
  style?: ViewStyle;
  children: React.ReactNode;
  duration?: number;
}

function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xFF) + amount);
  const b = Math.min(255, (num & 0xFF) + amount);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

export function BreathingGradient({ color, style, children, duration = 2500 }: BreathingGradientProps) {
  const breathAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1, duration, useNativeDriver: true }),
        Animated.timing(breathAnim, { toValue: 0, duration, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const borderRadius = (style as any)?.borderRadius ?? 16;

  return (
    <View style={[style, { overflow: 'hidden' }]}>
      {/* Base gradient */}
      <LinearGradient
        colors={[color, lighten(color, -30)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius }}
      />
      {/* Metallic silver sheen — subtle diagonal highlight */}
      <LinearGradient
        colors={['transparent', 'rgba(192,192,192,0.12)', 'rgba(220,220,220,0.18)', 'rgba(192,192,192,0.12)', 'transparent']}
        locations={[0, 0.35, 0.5, 0.65, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius }}
      />
      {/* Breathing overlay — lighter gradient that pulses */}
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: breathAnim }}>
        <LinearGradient
          colors={[lighten(color, 30), color]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ flex: 1, borderRadius }}
        />
      </Animated.View>
      {/* Content */}
      <View style={{ zIndex: 1 }}>
        {children}
      </View>
    </View>
  );
}
