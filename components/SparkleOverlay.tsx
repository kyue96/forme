import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

interface Spark {
  x: number;       // % from left
  y: number;       // % from top
  size: number;
  delay: number;
  opacity: Animated.Value;
  scale: Animated.Value;
  translateY: Animated.Value;
}

interface SparkleOverlayProps {
  trigger: boolean;
  color?: string;
  count?: number;
}

export default function SparkleOverlay({ trigger, color = '#C0C0C0', count = 14 }: SparkleOverlayProps) {
  const sparks = useRef<Spark[]>(
    Array.from({ length: count }, () => ({
      x: Math.random() * 90 + 5,
      y: Math.random() * 80 + 10,
      size: Math.random() * 6 + 4,
      delay: Math.random() * 400,
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
      translateY: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (!trigger) return;

    // Randomize positions each trigger
    sparks.forEach((s) => {
      s.x = Math.random() * 90 + 5;
      s.y = Math.random() * 80 + 10;
      s.size = Math.random() * 6 + 4;
      s.delay = Math.random() * 400;
      s.opacity.setValue(0);
      s.scale.setValue(0);
      s.translateY.setValue(0);
    });

    const animations = sparks.map((s) =>
      Animated.sequence([
        Animated.delay(s.delay),
        Animated.parallel([
          // Fade in then out
          Animated.sequence([
            Animated.timing(s.opacity, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(s.opacity, {
              toValue: 0,
              duration: 600,
              useNativeDriver: true,
            }),
          ]),
          // Scale up then shrink
          Animated.sequence([
            Animated.timing(s.scale, {
              toValue: 1.2,
              duration: 350,
              useNativeDriver: true,
            }),
            Animated.timing(s.scale, {
              toValue: 0,
              duration: 550,
              useNativeDriver: true,
            }),
          ]),
          // Drift upward
          Animated.timing(s.translateY, {
            toValue: -20,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    Animated.stagger(30, animations).start();
  }, [trigger]);

  if (!trigger) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {sparks.map((s, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: `${s.x}%`,
            top: `${s.y}%`,
            opacity: s.opacity,
            transform: [
              { scale: s.scale },
              { translateY: s.translateY },
            ],
          }}
        >
          {/* 4-point star shape using two rotated squares */}
          <View style={{ width: s.size, height: s.size, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{
              position: 'absolute',
              width: s.size * 0.4,
              height: s.size,
              backgroundColor: color,
              borderRadius: s.size * 0.2,
            }} />
            <View style={{
              position: 'absolute',
              width: s.size,
              height: s.size * 0.4,
              backgroundColor: color,
              borderRadius: s.size * 0.2,
            }} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}
