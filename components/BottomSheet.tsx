import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  View,
} from 'react-native';
import { useSettings } from '@/lib/settings-context';

const SLIDE_DURATION = 350;
const DISMISS_THRESHOLD = 80;
const EXPAND_THRESHOLD = 50;

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Extra keyboard offset if needed (default 0) */
  keyboardOffset?: number;
  /** Called when user swipes up past threshold */
  onExpand?: () => void;
  /** Hide the drag handle bar */
  hideHandle?: boolean;
}

export function BottomSheet({ visible, onClose, children, keyboardOffset = 0, onExpand, hideHandle }: BottomSheetProps) {
  const { theme } = useSettings();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;

  // Keep refs to latest callbacks so PanResponder always has fresh references
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onExpandRef = useRef(onExpand);
  onExpandRef.current = onExpand;

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(0);
      panY.setValue(0);
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: SLIDE_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const dismiss = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: SLIDE_DURATION,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      panY.setValue(0);
      onCloseRef.current();
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8,
        onPanResponderMove: (_, g) => {
          if (g.dy > 0) panY.setValue(g.dy);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy < -EXPAND_THRESHOLD && onExpandRef.current) {
            // Swiped up - expand
            onExpandRef.current();
            Animated.spring(panY, { toValue: 0, useNativeDriver: true, speed: 10 }).start();
          } else if (g.dy > DISMISS_THRESHOLD) {
            // Swiped down - dismiss
            Animated.timing(panY, {
              toValue: 500,
              duration: SLIDE_DURATION,
              easing: Easing.in(Easing.cubic),
              useNativeDriver: true,
            }).start(() => {
              panY.setValue(0);
              onCloseRef.current();
            });
          } else {
            // Snap back
            Animated.spring(panY, {
              toValue: 0,
              useNativeDriver: true,
              speed: 10,
            }).start();
          }
        },
      }),
    [],
  );

  const translateY = Animated.add(
    slideAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }),
    panY,
  );

  const backdropOpacity = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss}>
      {/* Backdrop */}
      <Pressable style={{ flex: 1 }} onPress={dismiss}>
        <Animated.View style={{ flex: 1, backgroundColor: '#000', opacity: backdropOpacity }} />
      </Pressable>

      {/* Sheet */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={keyboardOffset}
      >
        <Animated.View
          {...panResponder.panHandlers}
          style={{
            backgroundColor: theme.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            paddingBottom: 48,
            transform: [{ translateY }],
          }}
        >
          {/* Handle */}
          {!hideHandle && <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: 'center', marginBottom: 16 }} />}
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
