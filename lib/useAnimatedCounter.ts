import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

export function useAnimatedCounter(target: number, duration = 2400): { display: number; done: boolean } {
  const [display, setDisplay] = useState(0);
  const [done, setDone] = useState(false);
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (target === 0) {
      setDisplay(0);
      setDone(false);
      animatedValue.setValue(0);
      return;
    }

    setDone(false);
    animatedValue.setValue(0);

    const listener = animatedValue.addListener(({ value }) => {
      setDisplay(Math.round(value));
    });

    Animated.timing(animatedValue, {
      toValue: target,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        setDisplay(target); // ensure exact final value
        setDone(true);
      }
    });

    return () => {
      animatedValue.removeListener(listener);
      animatedValue.stopAnimation();
    };
  }, [target, duration]);

  return { display, done };
}
