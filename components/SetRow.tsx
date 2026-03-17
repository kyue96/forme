import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '@/lib/settings-context';
import { LoggedSet } from '@/lib/types';
import { isBarbell } from '@/lib/plate-calculator';
import { PlateCalculatorSheet } from '@/components/PlateCalculatorSheet';

interface SetRowProps {
  setNumber: number;
  data: LoggedSet;
  onChange: (data: LoggedSet) => void;
  onComplete: () => void;
  isBodyweight?: boolean;
  weightLabel?: string;
  exerciseName?: string;
  weightInputRef?: (el: TextInput | null) => void;
  repsInputRef?: (el: TextInput | null) => void;
  onWeightSubmit?: () => void;
  onRepsSubmit?: () => void;
  isLastSet?: boolean;
  isDropSet?: boolean;
  showLabels?: boolean;
}

export function SetRow({
  setNumber,
  data,
  onChange,
  onComplete,
  isBodyweight,
  weightLabel = 'Weight',
  exerciseName = '',
  weightInputRef,
  repsInputRef,
  onWeightSubmit,
  onRepsSubmit,
  isLastSet,
  isDropSet,
  showLabels = true,
}: SetRowProps) {
  const { theme, weightUnit } = useSettings();
  const prevCompleted = useRef(data.completed);
  const weightStep = weightUnit === 'lbs' ? 5 : 2.5;
  const showIncrement = setNumber >= 2 && !isBodyweight && !data.completed;
  const [showPlateCalc, setShowPlateCalc] = useState(false);
  const showCalcIcon = !isBodyweight && exerciseName !== '' && isBarbell(exerciseName) && !data.completed;

  // Auto-check: when both weight and reps have values, auto-complete
  useEffect(() => {
    if (data.completed || prevCompleted.current) {
      prevCompleted.current = data.completed;
      return;
    }
    const hasWeight = isBodyweight || (data.weight != null && data.weight > 0);
    const hasReps = data.reps > 0;
    if (hasWeight && hasReps) {
      // Use requestAnimationFrame to ensure state is flushed before completing
      requestAnimationFrame(() => {
        onComplete();
      });
    }
  }, [data.weight, data.reps]);

  const handleToggle = () => {
    if (data.completed) {
      prevCompleted.current = false;
      onChange({ ...data, completed: false });
    } else {
      onComplete();
    }
  };

  const handleWeightChange = (v: string) => {
    // Allow decimals: keep trailing dot and partial decimals
    if (v === '' || v === '.') {
      onChange({ ...data, weight: v === '' ? null : 0 });
      return;
    }
    const weight = parseFloat(v);
    if (!isNaN(weight)) {
      onChange({ ...data, weight });
    }
  };

  const handleRepsChange = (v: string) => {
    const reps = parseInt(v) || 0;
    onChange({ ...data, reps });
  };

  const handleFocusUncheck = () => {
    if (data.completed) {
      prevCompleted.current = false;
      onChange({ ...data, completed: false });
    }
  };

  return (
    <Pressable onPress={data.completed ? handleToggle : undefined} style={{
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      padding: 12,
      paddingLeft: isDropSet ? 24 : 12,
      borderRadius: 12,
      backgroundColor: data.completed ? theme.surface : theme.background,
      borderWidth: 1,
      borderColor: data.completed ? '#22C55E' : theme.border,
    }}>
      {/* Drop set indicator */}
      {isDropSet && (
        <Ionicons name="arrow-down" size={14} color={theme.chrome} style={{ marginRight: 4 }} />
      )}
      {/* Set number */}
      <Text style={{ width: 24, fontSize: 13, fontWeight: '600', color: theme.textSecondary }}>{setNumber}</Text>

      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {!isBodyweight && (
          <>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              {showIncrement && (
                <Pressable
                  onPress={() => {
                    const w = Math.max(0, (data.weight ?? 0) - weightStep);
                    onChange({ ...data, weight: w > 0 ? w : null });
                  }}
                  hitSlop={8}
                  style={{ alignItems: 'center', justifyContent: 'center', marginRight: 4, padding: 4 }}
                >
                  <Text style={{ fontSize: 18, fontWeight: '700', color: theme.textSecondary, lineHeight: 20 }}>−</Text>
                </Pressable>
              )}
              <TextInput
                ref={weightInputRef}
                style={{ flex: 1, fontSize: 16, fontWeight: '600', color: theme.text, backgroundColor: theme.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
                keyboardType="decimal-pad"
                returnKeyType={isLastSet ? 'done' : 'next'}
                placeholder={showLabels ? (weightUnit === 'lbs' ? 'lb' : 'kg') : ''}
                placeholderTextColor={theme.textSecondary}
                underlineColorAndroid="transparent"
                value={data.weight != null ? String(data.weight) : ''}
                onChangeText={handleWeightChange}
                onSubmitEditing={onWeightSubmit}
                onFocus={handleFocusUncheck}
              />
              {showIncrement && (
                <Pressable
                  onPress={() => onChange({ ...data, weight: (data.weight ?? 0) + weightStep })}
                  hitSlop={8}
                  style={{ alignItems: 'center', justifyContent: 'center', marginLeft: 4, padding: 4 }}
                >
                  <Text style={{ fontSize: 18, fontWeight: '700', color: theme.textSecondary, lineHeight: 20 }}>+</Text>
                </Pressable>
              )}
              {showCalcIcon && !showIncrement && (
                <Pressable onPress={() => setShowPlateCalc(true)} hitSlop={6} style={{ marginLeft: 6 }}>
                  <Ionicons name="calculator-outline" size={16} color={theme.chrome} />
                </Pressable>
              )}
            </View>
            <View style={{ width: 1, height: 32, backgroundColor: theme.border }} />
          </>
        )}

        <View style={{ flex: 1 }}>
          <TextInput
            ref={repsInputRef}
            style={{ fontSize: 16, fontWeight: '600', color: theme.text, backgroundColor: theme.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
            keyboardType="decimal-pad"
            returnKeyType="next"
            placeholder={showLabels ? 'reps' : ''}
            placeholderTextColor={theme.textSecondary}
            underlineColorAndroid="transparent"
            value={data.reps > 0 ? String(data.reps) : ''}
            onChangeText={handleRepsChange}
            onSubmitEditing={onRepsSubmit}
            onFocus={handleFocusUncheck}
          />
        </View>
      </View>

      {showCalcIcon && (
        <PlateCalculatorSheet
          visible={showPlateCalc}
          onClose={() => setShowPlateCalc(false)}
          onConfirm={(weight) => onChange({ ...data, weight })}
          initialWeight={data.weight}
        />
      )}
    </Pressable>
  );
}
