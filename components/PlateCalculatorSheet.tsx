import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '@/lib/settings-context';
import {
  calculatePlatesPerSide,
  defaultBarWeight,
  getBarWeights,
} from '@/lib/plate-calculator';
import type { PlateBreakdown } from '@/lib/plate-calculator';

interface PlateCalculatorSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (weight: number) => void;
  initialWeight?: number | null;
}

export function PlateCalculatorSheet({
  visible,
  onClose,
  onConfirm,
  initialWeight,
}: PlateCalculatorSheetProps) {
  const { theme, weightUnit } = useSettings();
  const unit = weightUnit === 'lbs' ? 'lb' : 'kg';

  const barWeights = getBarWeights(weightUnit);

  const [barWeight, setBarWeight] = useState(defaultBarWeight(weightUnit));
  const [totalText, setTotalText] = useState('');
  const [totalWeight, setTotalWeight] = useState(0);
  const [breakdown, setBreakdown] = useState<PlateBreakdown>({ plates: [], remainder: 0 });

  // Reset when opening or when unit changes
  useEffect(() => {
    if (visible) {
      const bar = defaultBarWeight(weightUnit);
      setBarWeight(bar);
      if (initialWeight != null && initialWeight > 0) {
        setTotalText(String(initialWeight));
        setTotalWeight(initialWeight);
        setBreakdown(calculatePlatesPerSide(initialWeight, bar, weightUnit));
      } else {
        setTotalText('');
        setTotalWeight(0);
        setBreakdown({ plates: [], remainder: 0 });
      }
    }
  }, [visible, weightUnit]);

  const handleTotalChange = (text: string) => {
    setTotalText(text);
    const val = parseFloat(text);
    if (!isNaN(val) && val > 0) {
      setTotalWeight(val);
      setBreakdown(calculatePlatesPerSide(val, barWeight, weightUnit));
    } else {
      setTotalWeight(0);
      setBreakdown({ plates: [], remainder: 0 });
    }
  };

  const handleBarChange = (bw: number) => {
    setBarWeight(bw);
    if (totalWeight > 0) {
      setBreakdown(calculatePlatesPerSide(totalWeight, bw, weightUnit));
    }
  };

  const handleConfirm = () => {
    if (totalWeight > 0) {
      onConfirm(totalWeight);
    }
    onClose();
  };

  const isStandard = (bw: number) =>
    (weightUnit === 'lbs' && bw === 45) || (weightUnit === 'kg' && bw === 20);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const backdropOpacity = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] });
  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] });

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(0);
      Animated.timing(slideAnim, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [visible]);

  const dismiss = () => {
    Animated.timing(slideAnim, { toValue: 0, duration: 350, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => onClose());
  };

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={dismiss}>
      <Pressable style={{ flex: 1 }} onPress={dismiss}>
        <Animated.View style={{ flex: 1, backgroundColor: '#000', opacity: backdropOpacity }} />
      </Pressable>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <Animated.View style={{ transform: [{ translateY }] }}>
        <SafeAreaView
          style={{
            backgroundColor: theme.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 24,
            paddingTop: 20,
            paddingBottom: 32,
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>Plate Calculator</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ScrollView bounces={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Large target weight display */}
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 48, fontWeight: '800', color: theme.text, fontVariant: ['tabular-nums'] }}>
                {totalWeight > 0 ? totalWeight : '—'}
              </Text>
              <Text style={{ fontSize: 14, color: theme.textSecondary, fontWeight: '600', marginTop: 4 }}>{unit}</Text>
            </View>

            {/* Total weight input */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: theme.background,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.border,
              paddingHorizontal: 14,
              marginBottom: 20,
            }}>
              <TextInput
                style={{
                  flex: 1,
                  fontSize: 18,
                  fontWeight: '600',
                  color: theme.text,
                  paddingVertical: 14,
                }}
                keyboardType="decimal-pad"
                placeholder="Enter target weight"
                placeholderTextColor={theme.textSecondary}
                value={totalText}
                onChangeText={handleTotalChange}
              />
              <Text style={{ fontSize: 14, color: theme.textSecondary, fontWeight: '600' }}>{unit}</Text>
            </View>

            {/* Bar weight selector */}
            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginBottom: 10 }}>Bar Weight</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
              {barWeights.map((bw) => (
                <Pressable
                  key={bw}
                  onPress={() => handleBarChange(bw)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 20,
                    backgroundColor: barWeight === bw ? theme.text : theme.background,
                    borderWidth: 1,
                    borderColor: barWeight === bw ? theme.text : theme.border,
                  }}
                >
                  <Text style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: barWeight === bw ? theme.background : theme.text,
                  }}>
                    {bw} {unit}{isStandard(bw) ? ' (Standard)' : ''}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Plate breakdown list */}
            {breakdown.plates.length > 0 && (
              <View style={{
                backgroundColor: theme.background,
                borderRadius: 12,
                padding: 16,
                marginBottom: 24,
              }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginBottom: 12 }}>Each Side</Text>
                {breakdown.plates.map((p) => (
                  <View key={p.weight} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: theme.text }}>
                      {p.weight} {unit}
                    </Text>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: theme.textSecondary }}>
                      × {p.count}
                    </Text>
                  </View>
                ))}
                {breakdown.remainder > 0 && (
                  <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 8 }}>
                    +{breakdown.remainder} {unit} remainder
                  </Text>
                )}
              </View>
            )}

            {/* Confirm */}
            <Pressable
              onPress={handleConfirm}
              style={{
                backgroundColor: theme.text,
                borderRadius: 12,
                paddingVertical: 16,
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: theme.background }}>
                {totalWeight > 0 ? `Load ${totalWeight} ${unit}` : 'Close'}
              </Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
