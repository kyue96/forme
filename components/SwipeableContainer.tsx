import React, { useRef } from 'react';
import { PanResponder, View, ViewStyle } from 'react-native';

interface SwipeableContainerProps {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  velocityThreshold?: number;
  style?: ViewStyle;
  children: React.ReactNode;
}

/**
 * Reusable swipe container — wrap any content to detect left/right swipes.
 *
 * Usage:
 *   <SwipeableContainer onSwipeLeft={goNext} onSwipeRight={goPrev}>
 *     {content}
 *   </SwipeableContainer>
 *
 * Props:
 *   onSwipeLeft  — called on left swipe (e.g., go to next item)
 *   onSwipeRight — called on right swipe (e.g., go to previous item)
 *   threshold    — minimum drag distance in px (default: 50)
 *   velocityThreshold — minimum swipe velocity for a fast flick (default: 0.3)
 *   style        — optional style for the wrapper View
 */
export function SwipeableContainer({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
  velocityThreshold = 0.3,
  style,
  children,
}: SwipeableContainerProps) {
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 20 && Math.abs(gs.dx) > Math.abs(gs.dy) * 2,
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -threshold || (gs.vx < -velocityThreshold && gs.dx < -20)) {
          onSwipeLeft?.();
        } else if (gs.dx > threshold || (gs.vx > velocityThreshold && gs.dx > 20)) {
          onSwipeRight?.();
        }
      },
    })
  ).current;

  return (
    <View {...panResponder.panHandlers} style={style}>
      {children}
    </View>
  );
}
