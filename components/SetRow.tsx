import { useEffect, useRef, useState } from 'react';
import { InputAccessoryView, Keyboard, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '@/lib/settings-context';
import { LoggedSet } from '@/lib/types';
import { isBarbell } from '@/lib/plate-calculator';
import { PlateCalculatorSheet } from '@/components/PlateCalculatorSheet';

// Module-level ref so the shared InputAccessoryView always calls the active row's handler
const activeNextHandler: { current: (() => void) | null } = { current: null };

export const SET_ROW_ACCESSORY_ID = 'setRowKeyboard';

/** Render once in the parent screen — shared across all SetRow inputs */
export function SetRowKeyboardAccessory() {
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={SET_ROW_ACCESSORY_ID}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#d1d5db', paddingHorizontal: 16, paddingVertical: 10 }}>
        <Pressable onPress={() => Keyboard.dismiss()} hitSlop={8}>
          <Text style={{ fontSize: 17, color: '#007AFF' }}>Cancel</Text>
        </Pressable>
        <Pressable onPress={() => { activeNextHandler.current?.(); }} hitSlop={8}>
          <Text style={{ fontSize: 17, fontWeight: '600', color: '#007AFF' }}>Next</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

interface SetRowProps {
  setNumber: number;
  data: LoggedSet;
  onChange: (data: LoggedSet) => void;
  onComplete: () => void;
  onDelete?: () => void;
  isBodyweight?: boolean;
  weightLabel?: string;
  exerciseName?: string;
  weightInputRef?: (el: TextInput | null) => void;
  repsInputRef?: (el: TextInput | null) => void;
  onWeightSubmit?: () => void;
  onRepsSubmit?: () => void;
  isLastSet?: boolean;
  isSuperset?: boolean;
  isDropSet?: boolean;
  showLabels?: boolean;
}

export function SetRow({
  setNumber,
  data,
  onChange,
  onComplete,
  onDelete,
  isBodyweight,
  weightLabel = 'Weight',
  exerciseName = '',
  weightInputRef,
  repsInputRef,
  onWeightSubmit,
  onRepsSubmit,
  isLastSet,
  isSuperset,
  isDropSet,
  showLabels = true,
}: SetRowProps) {
  const { theme, weightUnit } = useSettings();
  const prevCompleted = useRef(data.completed);
  const weightStep = weightUnit === 'lbs' ? 5 : 2.5;
  const focusedField = useRef<'weight' | 'reps' | null>(null);
  const isBarbellExercise = !isBodyweight && exerciseName !== '' && isBarbell(exerciseName);
  const showIncrement = setNumber >= 2 && !isBodyweight && !data.completed && !isBarbellExercise;
  const [showPlateCalc, setShowPlateCalc] = useState(false);
  const showCalcIcon = isBarbellExercise && !data.completed;
  const swipeRef = useRef<Swipeable>(null);
  const repsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-check: when both weight and reps have values, auto-complete
  // For the last set, delay 3s so user can blur to complete immediately
  const autoCompleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (autoCompleteTimerRef.current) clearTimeout(autoCompleteTimerRef.current);
    if (data.completed || prevCompleted.current) {
      prevCompleted.current = data.completed;
      return;
    }
    const hasWeight = isBodyweight || (data.weight != null && data.weight > 0);
    const hasReps = data.reps > 0;
    if (hasWeight && hasReps) {
      if (isLastSet || isSuperset) {
        autoCompleteTimerRef.current = setTimeout(() => {
          onComplete();
        }, 3000);
      } else {
        requestAnimationFrame(() => {
          onComplete();
        });
      }
    }
    return () => { if (autoCompleteTimerRef.current) clearTimeout(autoCompleteTimerRef.current); };
  }, [data.weight, data.reps]);

  // On last set reps blur: if reps entered, complete immediately
  const handleRepsBlur = () => {
    if (isLastSet && !data.completed && data.reps > 0) {
      const hasWeight = isBodyweight || (data.weight != null && data.weight > 0);
      if (hasWeight) {
        if (autoCompleteTimerRef.current) clearTimeout(autoCompleteTimerRef.current);
        if (repsTimerRef.current) clearTimeout(repsTimerRef.current);
        prevCompleted.current = true;
        onChange({ ...data, completed: true });
        onComplete();
      }
    }
  };

  // After reps typing stops for 3s, auto-focus next set's reps
  useEffect(() => {
    if (repsTimerRef.current) clearTimeout(repsTimerRef.current);
    if (data.reps > 0 && onRepsSubmit) {
      repsTimerRef.current = setTimeout(() => {
        onRepsSubmit();
      }, 3000);
    }
    return () => { if (repsTimerRef.current) clearTimeout(repsTimerRef.current); };
  }, [data.reps]);

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

  const renderRightActions = () => {
    if (!onDelete) return null;
    return (
      <Pressable
        onPress={() => {
          swipeRef.current?.close();
          onDelete();
        }}
        style={{
          backgroundColor: '#EF4444',
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          width: 56,
          marginLeft: 8,
          marginBottom: 8,
        }}
      >
        <Ionicons name="trash-outline" size={20} color="#fff" />
      </Pressable>
    );
  };

  const rowContent = (
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
                onFocus={() => { focusedField.current = 'weight'; activeNextHandler.current = () => onWeightSubmit?.(); handleFocusUncheck(); }}
                {...(Platform.OS === 'ios' ? { inputAccessoryViewID: SET_ROW_ACCESSORY_ID } : {})}
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
              {showCalcIcon && (
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
            onFocus={() => { focusedField.current = 'reps'; activeNextHandler.current = () => onRepsSubmit?.(); handleFocusUncheck(); }}
            onBlur={handleRepsBlur}
            {...(Platform.OS === 'ios' ? { inputAccessoryViewID: SET_ROW_ACCESSORY_ID } : {})}
          />
        </View>
      </View>

      {showCalcIcon && (
        <PlateCalculatorSheet
          visible={showPlateCalc}
          onClose={() => setShowPlateCalc(false)}
          onConfirm={(weight) => onChange({ ...data, weight })}
          initialWeight={data.weight}
          exerciseName={exerciseName}
        />
      )}
    </Pressable>
  );

  if (onDelete) {
    return (
      <Swipeable
          ref={swipeRef}
          renderRightActions={renderRightActions}
          overshootRight={false}
          friction={2}
        >
          {rowContent}
        </Swipeable>
    );
  }

  return rowContent;
}
