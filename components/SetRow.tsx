import { useEffect, useRef, useState, useCallback } from 'react';
import { InputAccessoryView, Keyboard, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '@/lib/settings-context';
import { LoggedSet } from '@/lib/types';
import { isBarbell } from '@/lib/plate-calculator';
import { PlateCalculatorSheet } from '@/components/PlateCalculatorSheet';
import { detectRapidTapIncrement } from '@/lib/exercise-increments';

// Module-level ref so the shared InputAccessoryView always calls the active row's handler
const activeNextHandler: { current: (() => void) | null } = { current: null };

export const SET_ROW_ACCESSORY_ID = 'setRowKeyboard';

/** Render once in the parent screen - shared across all SetRow inputs */
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
  equipment?: string | null;
  /** Adaptive weight increment for this exercise (in display units). */
  adaptiveIncrement?: number;
  /** Called when user taps +/- with the absolute delta applied (in display units). */
  onWeightDelta?: (delta: number) => void;
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
  equipment,
  adaptiveIncrement,
  onWeightDelta,
}: SetRowProps) {
  const { theme, weightUnit } = useSettings();
  const prevCompleted = useRef(data.completed);
  // Track whether weight/reps changed via user input (not from set add/remove re-render)
  const userEdited = useRef(false);
  const defaultStep = weightUnit === 'lbs' ? 5 : 2.5;
  const baseIncrement = adaptiveIncrement ?? defaultStep;
  const [weightStep, setWeightStep] = useState(baseIncrement);
  const tapTimestampsRef = useRef<number[]>([]);

  // Sync weightStep when adaptiveIncrement changes
  useEffect(() => {
    setWeightStep(adaptiveIncrement ?? defaultStep);
  }, [adaptiveIncrement, defaultStep]);

  // Rapid-tap detection: check timestamps after each tap
  const handleIncrementTap = useCallback((direction: 1 | -1) => {
    userEdited.current = true;
    const currentStep = adaptiveIncrement ?? defaultStep;
    const now = Date.now();
    tapTimestampsRef.current.push(now);
    // Keep only recent taps (last 2 seconds)
    tapTimestampsRef.current = tapTimestampsRef.current.filter(t => now - t < 2000);

    // Check for rapid tapping pattern
    const rapidIncrement = detectRapidTapIncrement(tapTimestampsRef.current, currentStep);
    if (rapidIncrement != null && rapidIncrement !== weightStep) {
      setWeightStep(rapidIncrement);
      // Reset timestamps so we don't re-detect immediately
      tapTimestampsRef.current = [];
    }

    const step = rapidIncrement ?? weightStep;
    const delta = step * direction;
    const newWeight = Math.max(0, (data.weight ?? 0) + delta);
    onChange({ ...data, weight: newWeight > 0 ? newWeight : null, suggestedWeight: undefined });
    onWeightDelta?.(Math.abs(step));
  }, [data, onChange, onWeightDelta, weightStep, adaptiveIncrement, defaultStep]);
  const focusedField = useRef<'weight' | 'reps' | null>(null);
  const isBarbellExercise = !isBodyweight && exerciseName !== '' && (
    equipment ? equipment === 'Barbell' : isBarbell(exerciseName)
  );
  const showIncrement = setNumber >= 2 && !isBodyweight && !data.completed && !isBarbellExercise;
  const [showPlateCalc, setShowPlateCalc] = useState(false);
  const localRepsRef = useRef<TextInput>(null);
  const showCalcIcon = isBarbellExercise && !data.completed;
  // Local text state for weight input — preserves trailing dots/partial decimals while typing
  const [weightText, setWeightText] = useState(data.weight != null ? String(data.weight) : '');
  const weightTextInternal = useRef(false); // true when change came from local typing
  const swipeRef = useRef<Swipeable>(null);
  const repsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync weightText from external data changes (e.g. plate calc, increment buttons)
  useEffect(() => {
    if (weightTextInternal.current) { weightTextInternal.current = false; return; }
    setWeightText(data.weight != null ? String(data.weight) : '');
  }, [data.weight]);

  // Auto-check: when both weight and reps have values, auto-complete
  // For the last set, delay 2s so user can blur to complete immediately
  const autoCompleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (autoCompleteTimerRef.current) clearTimeout(autoCompleteTimerRef.current);

    // Guard: never re-fire on already-completed sets
    if (data.completed || prevCompleted.current) {
      prevCompleted.current = data.completed;
      return;
    }

    // Guard: only auto-complete when the change came from actual user input,
    // not from data shifting due to set add/remove causing re-render
    if (!userEdited.current) return;
    userEdited.current = false;

    const hasWeight = isBodyweight || (data.weight != null && data.weight > 0);
    const hasReps = data.reps > 0;
    if (hasWeight && hasReps) {
      if (isLastSet) {
        // Last set: don't auto-complete — user manually checks then clicks Next arrow
      } else if (isSuperset) {
        autoCompleteTimerRef.current = setTimeout(() => {
          onComplete();
        }, 2000);
      } else {
        requestAnimationFrame(() => {
          onComplete();
        });
      }
    }
    return () => { if (autoCompleteTimerRef.current) clearTimeout(autoCompleteTimerRef.current); };
  }, [data.weight, data.reps]);

  // On last set reps blur: no auto-complete — user manually clicks checkmark then Next arrow
  const handleRepsBlur = () => {};

  // After reps typing stops for 2s, auto-focus next set's reps
  // Only fire when user actually edited, not on mount/re-mount of completed sets
  const repsUserEdited = useRef(false);
  useEffect(() => {
    if (repsTimerRef.current) clearTimeout(repsTimerRef.current);
    if (data.reps > 0 && onRepsSubmit && repsUserEdited.current) {
      repsUserEdited.current = false;
      repsTimerRef.current = setTimeout(() => {
        onRepsSubmit();
      }, 2000);
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
    userEdited.current = true;
    weightTextInternal.current = true;
    setWeightText(v);
    // Allow decimals: keep trailing dot and partial decimals in local text state
    if (v === '' || v === '.') {
      onChange({ ...data, weight: v === '' ? null : 0, suggestedWeight: undefined });
      return;
    }
    const weight = parseFloat(v);
    if (!isNaN(weight)) {
      onChange({ ...data, weight, suggestedWeight: undefined });
    }
  };

  const handleRepsChange = (v: string) => {
    userEdited.current = true;
    repsUserEdited.current = true;
    const reps = parseInt(v) || 0;
    onChange({ ...data, reps });
  };

  // Only uncheck on direct user tap, not programmatic focus or re-mount
  const userTapped = useRef(false);
  const handleFocusUncheck = () => {
    if (data.completed && userTapped.current) {
      prevCompleted.current = false;
      onChange({ ...data, completed: false });
    }
    userTapped.current = false;
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
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {showIncrement && (
                  <Pressable
                    onPress={() => handleIncrementTap(-1)}
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
                  value={weightText}
                  onChangeText={handleWeightChange}
                  onSubmitEditing={onWeightSubmit}
                  onPressIn={() => { userTapped.current = true; }}
                  onFocus={() => { focusedField.current = 'weight'; activeNextHandler.current = () => onWeightSubmit?.(); handleFocusUncheck(); }}
                  {...(Platform.OS === 'ios' ? { inputAccessoryViewID: SET_ROW_ACCESSORY_ID } : {})}
                />
                {showIncrement && (
                  <Pressable
                    onPress={() => handleIncrementTap(1)}
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
              {/* Hidden: weight increment/decrement suggestion — re-enable when UX is finalized
              {data.suggestedWeight != null && data.suggestedWeight !== data.weight && (
                <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4, marginLeft: 2 }}>
                  {data.suggestedWeight > (data.weight ?? 0) ? '↑' : '↓'} {Math.abs((data.suggestedWeight ?? 0) - (data.weight ?? 0))} {weightUnit === 'lbs' ? 'lbs' : 'kg'} {data.suggestedWeight > (data.weight ?? 0) ? '(high reps)' : '(low reps)'}
                </Text>
              )}
              */}
            </View>
            <View style={{ width: 1, height: 32, backgroundColor: theme.border }} />
          </>
        )}

        <View style={{ flex: 1 }}>
          <TextInput
            ref={(el) => { localRepsRef.current = el; repsInputRef?.(el); }}
            style={{ fontSize: 16, fontWeight: '600', color: theme.text, backgroundColor: theme.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
            keyboardType="decimal-pad"
            returnKeyType="next"
            placeholder={showLabels ? 'reps' : ''}
            placeholderTextColor={theme.textSecondary}
            underlineColorAndroid="transparent"
            value={data.reps > 0 ? String(data.reps) : ''}
            onChangeText={handleRepsChange}
            onSubmitEditing={onRepsSubmit}
            onPressIn={() => { userTapped.current = true; }}
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
          onConfirm={(weight) => { userEdited.current = true; onChange({ ...data, weight, suggestedWeight: undefined }); setTimeout(() => localRepsRef.current?.focus(), 350); }}
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
