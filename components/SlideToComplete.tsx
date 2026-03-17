import { useRef, useState } from 'react';
import { Animated, Dimensions, PanResponder, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '@/lib/settings-context';

const THUMB_SIZE = 52;
const SLIDER_HEIGHT = 56;
const SLIDER_PADDING = 4;

interface SlideToCompleteProps {
  onComplete: () => void;
  disabled?: boolean;
  label?: string;
}

export function SlideToComplete({ onComplete, disabled, label = 'Slide to finish' }: SlideToCompleteProps) {
  const { theme } = useSettings();
  const [expanded, setExpanded] = useState(false);
  const [completed, setCompleted] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;
  const sliderWidth = useRef(0);

  const maxSlide = () => sliderWidth.current - THUMB_SIZE - SLIDER_PADDING * 2;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        const val = Math.max(0, Math.min(gestureState.dx, maxSlide()));
        translateX.setValue(val);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx >= maxSlide() * 0.85) {
          Animated.spring(translateX, {
            toValue: maxSlide(),
            useNativeDriver: true,
            speed: 12,
          }).start(() => {
            setCompleted(true);
            onComplete();
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            speed: 12,
          }).start();
        }
      },
    })
  ).current;

  if (!expanded) {
    return (
      <Pressable
        onPress={() => !disabled && setExpanded(true)}
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: disabled ? theme.border : theme.text,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="flag" size={22} color={disabled ? theme.textSecondary : theme.background} />
      </Pressable>
    );
  }

  const dismiss = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, speed: 20 }).start();
    setExpanded(false);
  };

  return (
    <>
      {/* Transparent overlay to dismiss on tap outside */}
      <Pressable
        onPress={dismiss}
        style={{
          position: 'absolute',
          top: -500,
          left: -500,
          right: -500,
          bottom: -500,
          zIndex: -1,
        }}
      />
      <View
        onLayout={(e) => { sliderWidth.current = e.nativeEvent.layout.width; }}
        style={{
          height: SLIDER_HEIGHT,
          backgroundColor: completed ? '#22C55E' : theme.text,
          borderRadius: SLIDER_HEIGHT / 2,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: SLIDER_PADDING,
          overflow: 'hidden',
          flex: 1,
        }}
      >
      {!completed && (
        <Text
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            textAlign: 'center',
            fontSize: 14,
            fontWeight: '600',
            color: theme.background,
            opacity: 0.5,
          }}
        >
          {label}
        </Text>
      )}

      {completed ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Saving…</Text>
        </View>
      ) : (
        <Animated.View
          {...panResponder.panHandlers}
          style={{
            width: THUMB_SIZE,
            height: THUMB_SIZE - SLIDER_PADDING * 2,
            borderRadius: (THUMB_SIZE - SLIDER_PADDING * 2) / 2,
            backgroundColor: theme.background,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ translateX }],
          }}
        >
          <Ionicons name="chevron-forward" size={20} color={theme.text} />
        </Animated.View>
      )}
      </View>
    </>
  );
}
