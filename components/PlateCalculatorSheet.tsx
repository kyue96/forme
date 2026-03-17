import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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
  calculateTotalFromPlates,
  defaultBarWeight,
  getBarWeights,
  getPlates,
} from '@/lib/plate-calculator';
import type { PlateBreakdown } from '@/lib/plate-calculator';

interface PlateCalculatorSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (weight: number) => void;
  initialWeight?: number | null;
  exerciseName?: string;
}

// Circle sizes: smallest plate → 36px, largest → 72px
function plateCircleSize(plateWeight: number, allPlates: readonly number[]): number {
  const min = allPlates[0];
  const max = allPlates[allPlates.length - 1];
  if (max === min) return 54;
  const t = (plateWeight - min) / (max - min);
  return Math.round(36 + t * 36);
}

export function PlateCalculatorSheet({
  visible,
  onClose,
  onConfirm,
  initialWeight,
  exerciseName,
}: PlateCalculatorSheetProps) {
  const { theme, weightUnit } = useSettings();
  const unit = weightUnit === 'lbs' ? 'lb' : 'kg';

  const barWeights = getBarWeights(weightUnit);
  const plates = getPlates(weightUnit);
  // Ascending order for display
  const platesAsc = [...plates].sort((a, b) => a - b);

  const [barWeight, setBarWeight] = useState(defaultBarWeight(weightUnit));
  const [totalText, setTotalText] = useState('');
  const [totalWeight, setTotalWeight] = useState(0);
  const [breakdown, setBreakdown] = useState<PlateBreakdown>({ plates: [], remainder: 0 });
  const [plateCounts, setPlateCounts] = useState<Record<number, number>>({});
  const [showBarOptions, setShowBarOptions] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Sync plateCounts from breakdown
  const syncCountsFromBreakdown = (bd: PlateBreakdown) => {
    const counts: Record<number, number> = {};
    for (const p of bd.plates) {
      counts[p.weight] = p.count;
    }
    setPlateCounts(counts);
  };

  // Reset when opening or when unit changes
  useEffect(() => {
    if (visible) {
      const bar = defaultBarWeight(weightUnit);
      setBarWeight(bar);
      if (initialWeight != null && initialWeight > 0) {
        setTotalText(String(initialWeight));
        setTotalWeight(initialWeight);
        const bd = calculatePlatesPerSide(initialWeight, bar, weightUnit);
        setBreakdown(bd);
        syncCountsFromBreakdown(bd);
      } else {
        setTotalText('');
        setTotalWeight(0);
        setBreakdown({ plates: [], remainder: 0 });
        setPlateCounts({});
      }
    }
  }, [visible, weightUnit]);

  const handleTotalChange = (text: string) => {
    setTotalText(text);
    const val = parseFloat(text);
    if (!isNaN(val) && val > 0) {
      setTotalWeight(val);
      const bd = calculatePlatesPerSide(val, barWeight, weightUnit);
      setBreakdown(bd);
      syncCountsFromBreakdown(bd);
    } else {
      setTotalWeight(0);
      setBreakdown({ plates: [], remainder: 0 });
      setPlateCounts({});
    }
  };

  const handleBarChange = (bw: number) => {
    setBarWeight(bw);
    // Recalculate total from current plate counts with new bar
    const newTotal = calculateTotalFromPlates(plateCounts, bw);
    setTotalWeight(newTotal);
    setTotalText(newTotal > 0 ? String(newTotal) : '');
    setBreakdown(calculatePlatesPerSide(newTotal, bw, weightUnit));
  };

  const handlePlateTap = (plateWeight: number) => {
    const newCounts = { ...plateCounts, [plateWeight]: (plateCounts[plateWeight] || 0) + 1 };
    setPlateCounts(newCounts);
    const newTotal = calculateTotalFromPlates(newCounts, barWeight);
    setTotalWeight(newTotal);
    setTotalText(String(newTotal));
    setBreakdown(calculatePlatesPerSide(newTotal, barWeight, weightUnit));
  };

  const handlePlateLongPress = (plateWeight: number) => {
    const current = plateCounts[plateWeight] || 0;
    if (current <= 0) return;
    const newCounts = { ...plateCounts, [plateWeight]: current - 1 };
    if (newCounts[plateWeight] === 0) delete newCounts[plateWeight];
    setPlateCounts(newCounts);
    const newTotal = calculateTotalFromPlates(newCounts, barWeight);
    setTotalWeight(newTotal);
    setTotalText(newTotal > 0 ? String(newTotal) : '');
    setBreakdown(calculatePlatesPerSide(newTotal, barWeight, weightUnit));
  };

  const handleResetPlates = () => {
    setPlateCounts({});
    const newTotal = barWeight;
    setTotalWeight(0);
    setTotalText('');
    setBreakdown({ plates: [], remainder: 0 });
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
      Animated.timing(slideAnim, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
        inputRef.current?.focus();
      });
    }
  }, [visible]);

  const dismiss = () => {
    Animated.timing(slideAnim, { toValue: 0, duration: 350, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => onClose());
  };

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={dismiss}>
      <Animated.View style={{ flex: 1, backgroundColor: '#000', opacity: backdropOpacity }} />
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, transform: [{ translateY }] }}>
        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: theme.surface,
            paddingTop: 12,
            paddingBottom: 32,
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingHorizontal: 24 }}>
            {exerciseName ? (
              <Text style={{ fontSize: 20, fontWeight: '700', color: theme.text, flex: 1, marginRight: 12 }} numberOfLines={1}>
                {exerciseName}
              </Text>
            ) : <View />}
            <Pressable onPress={dismiss} hitSlop={8}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ScrollView bounces={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24 }}>
            {/* Target weight input + Load button */}
            <Text style={{ fontSize: 15, fontWeight: '600', color: theme.textSecondary, marginBottom: 8 }}>Target Weight</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              <View style={{
                flex: 3,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.background,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.border,
                paddingHorizontal: 14,
              }}>
                <TextInput
                  ref={inputRef}
                  style={{
                    flex: 1,
                    fontSize: 20,
                    fontWeight: '600',
                    color: theme.text,
                    paddingVertical: 14,
                  }}
                  keyboardType="decimal-pad"
                  value={totalText}
                  onChangeText={handleTotalChange}
                />
                <Text style={{ fontSize: 16, color: theme.textSecondary, fontWeight: '600' }}>{unit}</Text>
              </View>
              <Pressable
                onPress={handleConfirm}
                style={{
                  flex: 1,
                  backgroundColor: totalWeight > 0 ? theme.text : theme.border,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 14,
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: theme.background }} numberOfLines={1}>
                  LOAD →
                </Text>
              </Pressable>
            </View>

            {/* Visual plate circles */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: theme.textSecondary }}>Plates (per side)</Text>
              {Object.values(plateCounts).some((c) => c > 0) && (
                <Pressable onPress={handleResetPlates} hitSlop={8}>
                  <Ionicons name="refresh-outline" size={18} color={theme.textSecondary} />
                </Pressable>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
              {platesAsc.map((pw) => {
                const size = plateCircleSize(pw, platesAsc);
                const count = plateCounts[pw] || 0;
                return (
                  <Pressable
                    key={pw}
                    onPress={() => handlePlateTap(pw)}
                    onLongPress={() => handlePlateLongPress(pw)}
                    style={{ alignItems: 'center' }}
                  >
                    <View style={{
                      width: size,
                      height: size,
                      borderRadius: size / 2,
                      backgroundColor: count > 0 ? theme.text : theme.background,
                      borderWidth: 2,
                      borderColor: count > 0 ? theme.text : theme.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Text style={{
                        fontSize: size < 44 ? 10 : 13,
                        fontWeight: '700',
                        color: count > 0 ? theme.background : theme.text,
                      }}>
                        {pw}
                      </Text>
                    </View>
                    {/* Count badge */}
                    {count > 0 && (
                      <View style={{
                        position: 'absolute',
                        top: -4,
                        right: -4,
                        backgroundColor: '#22C55E',
                        borderRadius: 10,
                        minWidth: 20,
                        height: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingHorizontal: 4,
                      }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>{count}</Text>
                      </View>
                    )}
                    <Text style={{ fontSize: 10, color: theme.textSecondary, marginTop: 4 }}>{pw}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Bar weight selector */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: theme.textSecondary }}>Bar Weight: </Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>
                {barWeight} {unit}{isStandard(barWeight) ? ' (standard)' : ''}
              </Text>
              <Pressable onPress={() => setShowBarOptions(!showBarOptions)} hitSlop={8} style={{ marginLeft: 8 }}>
                <Ionicons name="pencil-outline" size={16} color={theme.textSecondary} />
              </Pressable>
            </View>
            {showBarOptions && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24, marginTop: -12 }}>
                {barWeights.map((bw) => (
                  <Pressable
                    key={bw}
                    onPress={() => { handleBarChange(bw); setShowBarOptions(false); }}
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
                      fontSize: 16,
                      fontWeight: '600',
                      color: barWeight === bw ? theme.background : theme.text,
                    }}>
                      {bw} {unit}{isStandard(bw) ? ' (standard)' : ''}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Plate breakdown list */}
            {breakdown.plates.length > 0 && (
              <View style={{
                backgroundColor: theme.background,
                borderRadius: 12,
                padding: 16,
                marginBottom: 24,
              }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: theme.textSecondary, marginBottom: 12 }}>Each Side</Text>
                {breakdown.plates.map((p) => (
                  <View key={p.weight} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
                    <Text style={{ fontSize: 18, fontWeight: '600', color: theme.text }}>
                      {p.weight} {unit}
                    </Text>
                    <Text style={{ fontSize: 18, fontWeight: '600', color: theme.textSecondary }}>
                      × {p.count}
                    </Text>
                  </View>
                ))}
                {breakdown.remainder > 0 && (
                  <Text style={{ fontSize: 15, color: theme.textSecondary, marginTop: 8 }}>
                    +{breakdown.remainder} {unit} remainder
                  </Text>
                )}
              </View>
            )}

          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}
