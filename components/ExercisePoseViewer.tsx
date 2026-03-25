import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

interface Props {
  startImage: any;  // require('...') asset
  endImage: any;
  size?: number;
  speed?: number;  // ms per cycle, default 2000
}

/**
 * Smoothly animates between start and end exercise pose images.
 * Creates a looping crossfade effect that shows the exercise movement.
 */
export function ExercisePoseViewer({ startImage, endImage, size = 280, speed = 2000 }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        // Hold start briefly
        Animated.delay(400),
        // Fade to end
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: speed * 0.4,
          useNativeDriver: true,
        }),
        // Hold end briefly
        Animated.delay(400),
        // Fade back to start
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: speed * 0.4,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [speed]);

  return (
    <View style={{ width: size, height: size * 1.5, alignSelf: 'center' }}>
      {/* Start pose — fades out as fadeAnim goes to 1 */}
      <Animated.View style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        opacity: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
      }}>
        <ExpoImage
          source={startImage}
          style={{ width: '100%', height: '100%' }}
          contentFit="contain"
        />
      </Animated.View>

      {/* End pose — fades in as fadeAnim goes to 1 */}
      <Animated.View style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        opacity: fadeAnim,
      }}>
        <ExpoImage
          source={endImage}
          style={{ width: '100%', height: '100%' }}
          contentFit="contain"
        />
      </Animated.View>
    </View>
  );
}
