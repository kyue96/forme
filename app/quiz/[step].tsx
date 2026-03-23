import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProgressBar } from '@/components/ProgressBar';
import { QuizTile } from '@/components/QuizTile';
import { useQuiz } from '@/lib/quiz-store';
import { useSettings } from '@/lib/settings-context';
import { animateLayout } from '@/lib/utils';

const TOTAL_STEPS = 8;

// Rebuild mode: only show equipment, schedule (days+duration), and split
const REBUILD_STEPS = [3, 4, 5] as const; // maps rebuild step 1->3, 2->4, 3->5
const REBUILD_TOTAL = REBUILD_STEPS.length;

const REBUILD_TITLES: Record<number, { title: string; subtitle: string }> = {
  1: { title: 'Equipment', subtitle: 'Update your available equipment.' },
  2: { title: 'Your Schedule', subtitle: 'Adjust days and session length.' },
  3: { title: 'Workout Style', subtitle: 'Change how you split muscle groups.' },
};

// --- Milestone suggestions by goal ---
const MILESTONE_MAP: Record<string, string[]> = {
  'Build muscle': ['Bench 225 lbs', 'Squat 315 lbs', 'Deadlift 405 lbs', 'Visible abs'],
  'Build strength': ['1.5× BW bench', '2× BW squat', 'First pull-up', '10 pull-ups'],
  'Lose weight': ['Lose 10 lbs', 'Lose 20 lbs', 'Lose 30 lbs', 'Fit in old clothes'],
  'Maintain weight': ['Stay consistent', 'Maintain current weight', 'Improve flexibility'],
  'Stay active': ['Run a 5K', 'Touch my toes', '30 min daily'],
};

function getMilestonesForGoals(goals: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const g of goals) {
    for (const m of MILESTONE_MAP[g] ?? []) {
      if (!seen.has(m)) {
        seen.add(m);
        result.push(m);
      }
    }
  }
  return result;
}

// --- Scroll wheel picker ---
const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

function ScrollWheelPicker({
  items,
  selectedIndex,
  onSelect,
}: {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const { theme } = useSettings();
  const scrollRef = useRef<ScrollView>(null);
  const paddedItems = ['', '', ...items, '', ''];

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(index, items.length - 1));
    onSelect(clamped);
  };

  return (
    <View style={{ height: PICKER_HEIGHT, overflow: 'hidden' }}>
      <View
        style={{ position: 'absolute', left: 0, right: 0, top: ITEM_HEIGHT * 2, height: ITEM_HEIGHT, backgroundColor: theme.surface, borderRadius: 12 } as ViewStyle}
        pointerEvents="none"
      />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        contentOffset={{ x: 0, y: selectedIndex * ITEM_HEIGHT }}
        onMomentumScrollEnd={handleMomentumEnd}
        scrollEventThrottle={16}
        nestedScrollEnabled
      >
        {paddedItems.map((item, index) => {
          const realIndex = index - 2;
          const isSelected = realIndex === selectedIndex;
          return (
            <View
              key={index}
              style={{ height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text
                allowFontScaling
                style={{ fontSize: 18, fontWeight: isSelected ? '700' : '400', color: isSelected ? theme.text : theme.border }}
              >
                {item}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function buildHeightOptions(): string[] {
  const options: string[] = [];
  for (let ft = 4; ft <= 6; ft++) {
    const maxIn = ft === 4 ? 11 : ft === 6 ? 10 : 11;
    const startIn = ft === 4 ? 8 : 0;
    for (let inc = startIn; inc <= maxIn; inc++) {
      options.push(`${ft}'${inc}"`);
    }
  }
  return options;
}

function buildWeightOptions(): string[] {
  const options: string[] = [];
  for (let w = 90; w <= 350; w += 5) {
    options.push(`${w} lbs`);
  }
  return options;
}

const HEIGHT_OPTIONS = buildHeightOptions();
const WEIGHT_OPTIONS = buildWeightOptions();

const MIN_AGE = 16;
const MAX_AGE = 80;

// --- Step titles ---
const STEP_TITLES: Record<number, { title: string; subtitle: string }> = {
  1: { title: 'About You', subtitle: 'Helps us personalize your plan.' },
  2: { title: 'Your Goals', subtitle: 'What are you working towards?' },
  3: { title: 'Experience & Equipment', subtitle: "We'll match exercises to your level and setup." },
  4: { title: 'Your Schedule', subtitle: "We'll fit everything into your routine." },
  5: { title: 'Workout Style', subtitle: "A 'split' is how you divide muscle groups across days." },
  6: { title: 'Plan Type', subtitle: 'Let us build it, or do it yourself.' },
  7: { title: 'Nutrition', subtitle: 'Helps us plan around your eating habits.' },
  8: { title: 'Final Details', subtitle: 'Almost done — just a few more things.' },
};

export default function QuizStepScreen() {
  const { step, mode } = useLocalSearchParams<{ step: string; mode?: string }>();
  const router = useRouter();
  const { answers, setAnswer, toggleEquipment, toggleGoal, toggleMilestone, toggleInjury, prefillAnswers, loadSavedAnswers } = useQuiz();
  const { theme, trackCalories, setTrackCalories } = useSettings();

  const isRebuild = mode === 'rebuild';
  const stepNum = parseInt(step ?? '1', 10);

  // The actual original-quiz step to render content for
  const effectiveStep = isRebuild ? REBUILD_STEPS[stepNum - 1] : stepNum;
  const totalSteps = isRebuild ? REBUILD_TOTAL : TOTAL_STEPS;

  // Load saved answers on first rebuild step mount
  const didLoad = useRef(false);
  useEffect(() => {
    if (isRebuild && !didLoad.current) {
      didLoad.current = true;
      loadSavedAnswers().then((saved) => {
        if (saved) prefillAnswers(saved);
      });
    }
  }, [isRebuild]);

  // Local state for scroll pickers (Step 1)
  const initHeightIdx = answers.height
    ? HEIGHT_OPTIONS.indexOf(answers.height)
    : HEIGHT_OPTIONS.indexOf("5'9\"");
  const initWeightIdx = answers.weight
    ? WEIGHT_OPTIONS.indexOf(answers.weight)
    : WEIGHT_OPTIONS.indexOf('170 lbs');

  const [heightIdx, setHeightIdx] = useState(Math.max(0, initHeightIdx));
  const [weightIdx, setWeightIdx] = useState(Math.max(0, initWeightIdx));
  const [ageValue, setAgeValue] = useState(answers.age ?? 25);

  const scrollViewRef = useRef<ScrollView>(null);

  const stepTitle = isRebuild
    ? (REBUILD_TITLES[stepNum] ?? { title: '', subtitle: '' })
    : (STEP_TITLES[stepNum] ?? { title: '', subtitle: '' });

  // --- canProceed per step ---
  const canProceed = (() => {
    // In rebuild mode, use effectiveStep but with relaxed requirements
    const checkStep = isRebuild ? effectiveStep : stepNum;
    switch (checkStep) {
      case 1: return !!answers.gender && !!(answers.name?.trim());
      case 2: return (answers.goal?.length ?? 0) > 0;
      case 3: return isRebuild
        ? (answers.equipment?.length ?? 0) > 0 // rebuild: only equipment needed
        : !!answers.experience && (answers.equipment?.length ?? 0) > 0;
      case 4: return isRebuild
        ? !!answers.daysPerWeek && !!answers.workoutDuration // rebuild: no start date needed
        : !!answers.daysPerWeek && !!answers.workoutDuration && !!answers.startDate;
      case 5: return !!answers.preferredSplit;
      case 6: return !!answers.routineChoice;
      case 7: return !!answers.mealsPerDay;
      case 8: return true;
      default: return false;
    }
  })();

  // --- handleNext ---
  const handleNext = () => {
    animateLayout();
    if (!isRebuild && stepNum === 1) {
      setAnswer('age', ageValue);
      setAnswer('height', HEIGHT_OPTIONS[heightIdx]);
      setAnswer('weight', WEIGHT_OPTIONS[weightIdx]);
    }

    if (isRebuild) {
      if (stepNum >= REBUILD_TOTAL) {
        // In rebuild, force routineChoice to 'Generate my plan' and set startDate
        setAnswer('routineChoice', 'Generate my plan');
        if (!answers.startDate) setAnswer('startDate', 'Today');
        if (!answers.injuries || answers.injuries.length === 0) {
          setAnswer('injuries', ['None'] as any);
        }
        router.push('/plan-result?mode=rebuild');
      } else {
        router.push(`/quiz/${stepNum + 1}?mode=rebuild`);
      }
    } else {
      if (stepNum === 8) {
        if (!answers.injuries || answers.injuries.length === 0) {
          setAnswer('injuries', ['None'] as any);
        }
        router.push('/plan-result');
      } else {
        router.push(`/quiz/${stepNum + 1}`);
      }
    }
  };

  // --- Render helpers ---
  const renderSectionLabel = (label: string) => (
    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginTop: 28, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
      {label}
    </Text>
  );

  const renderTileOptions = (options: string[], selectedCheck: (o: string) => boolean, onPress: (o: string) => void) => (
    <View>
      {options.map((option) => (
        <View key={option} style={{ marginBottom: 12 }}>
          <QuizTile label={option} selected={selectedCheck(option)} onPress={() => onPress(option)} />
        </View>
      ))}
    </View>
  );

  const renderInlineTiles = (options: string[], selectedCheck: (o: string) => boolean, onPress: (o: string) => void) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {options.map((option) => (
        <Pressable
          key={option}
          onPress={() => onPress(option)}
          style={{
            paddingHorizontal: 16, paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: selectedCheck(option) ? theme.text : theme.surface,
            borderWidth: 1,
            borderColor: selectedCheck(option) ? theme.text : theme.border,
          }}
        >
          <Text style={{
            fontSize: 14, fontWeight: '600',
            color: selectedCheck(option) ? theme.background : theme.text,
          }}>
            {option}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  // ─── Step 1: About You ───
  const renderStep1 = () => (
    <View>
      {renderSectionLabel('Your Name')}
      <TextInput
        style={{
          fontSize: 16,
          fontWeight: '600',
          color: theme.text,
          backgroundColor: theme.surface,
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderWidth: 1,
          borderColor: answers.name?.trim() ? theme.text : theme.border,
        }}
        placeholder="Enter your first name"
        placeholderTextColor={theme.textSecondary}
        value={answers.name ?? ''}
        onChangeText={(text) => setAnswer('name', text)}
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={30}
        returnKeyType="done"
      />

      {renderSectionLabel('Gender')}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {(['Male', 'Female'] as const).map((g) => (
          <View key={g} style={{ flex: 1 }}>
            <QuizTile label={g} selected={answers.gender === g} onPress={() => setAnswer('gender', g)} />
          </View>
        ))}
      </View>

      {renderSectionLabel('Age')}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 8 }}>
        <Pressable
          onPress={() => setAgeValue(Math.max(MIN_AGE, ageValue - 1))}
          style={{
            width: 48, height: 48, borderRadius: 24,
            backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 24, fontWeight: '600', color: theme.text }}>−</Text>
        </Pressable>
        <Text allowFontScaling style={{ fontSize: 48, fontWeight: '800', color: theme.text, minWidth: 80, textAlign: 'center' }}>
          {ageValue}
        </Text>
        <Pressable
          onPress={() => setAgeValue(Math.min(MAX_AGE, ageValue + 1))}
          style={{
            width: 48, height: 48, borderRadius: 24,
            backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 24, fontWeight: '600', color: theme.text }}>+</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 28, marginBottom: 12 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>
          Body Stats
        </Text>
        <View style={{ backgroundColor: theme.surface, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
          <Text style={{ fontSize: 10, fontWeight: '600', color: theme.textSecondary }}>Optional</Text>
        </View>
      </View>

      <Text allowFontScaling style={{ fontSize: 14, fontWeight: '500', color: theme.text, marginBottom: 8 }}>Height</Text>
      <ScrollWheelPicker items={HEIGHT_OPTIONS} selectedIndex={heightIdx} onSelect={setHeightIdx} />
      <View style={{ height: 16 }} />

      <Text allowFontScaling style={{ fontSize: 14, fontWeight: '500', color: theme.text, marginBottom: 8 }}>Current weight</Text>
      <ScrollWheelPicker items={WEIGHT_OPTIONS} selectedIndex={weightIdx} onSelect={setWeightIdx} />
    </View>
  );

  // ─── Step 2: Your Goals ───
  const renderStep2 = () => {
    const goals = answers.goal ?? [];
    const milestones = getMilestonesForGoals(goals);
    return (
      <View>
        {renderSectionLabel('Select all that apply')}
        {renderTileOptions(
          ['Build muscle', 'Build strength', 'Lose weight', 'Maintain weight', 'Stay active'],
          (o) => goals.includes(o as any),
          (o) => toggleGoal(o),
        )}

        {goals.length > 0 && (
          <>
            {renderSectionLabel('Set a milestone (up to 3)')}
            {renderInlineTiles(
              milestones,
              (o) => (answers.milestones ?? []).includes(o),
              (o) => toggleMilestone(o),
            )}
          </>
        )}
      </View>
    );
  };

  // ─── Step 3: Experience & Equipment ───
  const renderStep3 = () => (
    <View>
      {renderSectionLabel('Experience level')}
      {renderTileOptions(
        ['Beginner', 'Some experience', 'Intermediate', 'Advanced'],
        (o) => answers.experience === o,
        (o) => setAnswer('experience', o as any),
      )}

      {renderSectionLabel('Equipment (select all that apply)')}
      {renderTileOptions(
        ['Full gym', 'Dumbbells', 'Resistance bands', 'None'],
        (o) => (answers.equipment ?? []).includes(o as any),
        (o) => toggleEquipment(o),
      )}
    </View>
  );

  // ─── Step 4: Your Schedule ───
  const renderStep4 = () => (
    <View>
      {renderSectionLabel('Days per week')}
      {renderInlineTiles(
        ['2', '3', '4', '5+'],
        (o) => answers.daysPerWeek === o,
        (o) => setAnswer('daysPerWeek', o as any),
      )}

      {renderSectionLabel('Duration per workout')}
      {renderInlineTiles(
        ['30 min', '45 min', '60 min', '90 min'],
        (o) => answers.workoutDuration === o,
        (o) => setAnswer('workoutDuration', o as any),
      )}

      {renderSectionLabel('When do you want to start?')}
      {renderTileOptions(
        ['Today', 'Tomorrow', 'Next Monday'],
        (o) => answers.startDate === o,
        (o) => setAnswer('startDate', o as any),
      )}
    </View>
  );

  // ─── Step 5: Workout Style ───
  const renderStep5 = () => (
    <View>
      {renderTileOptions(
        ['Push/Pull/Legs', 'Full body', 'Upper/Lower'],
        (o) => answers.preferredSplit === o,
        (o) => setAnswer('preferredSplit', o as any),
      )}
    </View>
  );

  // ─── Step 6: Plan Type ───
  const renderStep6 = () => (
    <View>
      {renderTileOptions(
        ['Generate my plan', "I'll build my own"],
        (o) => answers.routineChoice === o,
        (o) => setAnswer('routineChoice', o as any),
      )}
    </View>
  );

  // ─── Step 7: Nutrition ───
  const renderStep7 = () => (
    <View>
      {renderSectionLabel('Meals per day')}
      {renderInlineTiles(
        ['2', '3', '4', '5+'],
        (o) => answers.mealsPerDay === o,
        (o) => setAnswer('mealsPerDay', o as any),
      )}

      {renderSectionLabel('Track calories & meals?')}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {(['Yes', 'No'] as const).map((opt) => (
          <View key={opt} style={{ flex: 1 }}>
            <QuizTile
              label={opt}
              selected={opt === 'Yes' ? trackCalories === true : trackCalories === false}
              onPress={() => setTrackCalories(opt === 'Yes')}
            />
          </View>
        ))}
      </View>
      <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 8, opacity: 0.7 }}>
        You can always change this later in Profile → Settings.
      </Text>
    </View>
  );

  // ─── Step 8: Final Details ───
  const renderStep8 = () => {
    const injuries = answers.injuries ?? [];
    return (
      <View>
        {renderSectionLabel('Areas to avoid')}
        {renderTileOptions(
          ['None', 'Lower back', 'Knees', 'Shoulders'],
          (o) => injuries.includes(o as any),
          (o) => toggleInjury(o),
        )}

        {renderSectionLabel('Rest timer between sets')}
        {renderInlineTiles(
          ['60s', '75s', '90s', '120s'],
          (o) => answers.restTimer === o,
          (o) => setAnswer('restTimer', o as any),
        )}

        {renderSectionLabel('Include warm-ups?')}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {(['Yes', 'No'] as const).map((opt) => (
            <View key={opt} style={{ flex: 1 }}>
              <QuizTile
                label={opt}
                selected={opt === 'Yes' ? answers.includeWarmups === true : answers.includeWarmups === false}
                onPress={() => setAnswer('includeWarmups', opt === 'Yes')}
              />
            </View>
          ))}
        </View>

        {renderSectionLabel('Workout reminders')}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {(['On', 'Off'] as const).map((opt) => (
            <View key={opt} style={{ flex: 1 }}>
              <QuizTile
                label={opt}
                selected={opt === 'On' ? answers.notifications === true : answers.notifications === false}
                onPress={() => setAnswer('notifications', opt === 'On')}
              />
            </View>
          ))}
        </View>
      </View>
    );
  };

  // ─── Rebuild: Equipment only (no experience) ───
  const renderRebuildEquipment = () => (
    <View>
      {renderSectionLabel('Equipment (select all that apply)')}
      {renderTileOptions(
        ['Full gym', 'Dumbbells', 'Resistance bands', 'None'],
        (o) => (answers.equipment ?? []).includes(o as any),
        (o) => toggleEquipment(o),
      )}
    </View>
  );

  // ─── Rebuild: Schedule without start date ───
  const renderRebuildSchedule = () => (
    <View>
      {renderSectionLabel('Days per week')}
      {renderInlineTiles(
        ['2', '3', '4', '5+'],
        (o) => answers.daysPerWeek === o,
        (o) => setAnswer('daysPerWeek', o as any),
      )}

      {renderSectionLabel('Duration per workout')}
      {renderInlineTiles(
        ['30 min', '45 min', '60 min', '90 min'],
        (o) => answers.workoutDuration === o,
        (o) => setAnswer('workoutDuration', o as any),
      )}
    </View>
  );

  const renderStepContent = () => {
    if (isRebuild) {
      switch (effectiveStep) {
        case 3: return renderRebuildEquipment();
        case 4: return renderRebuildSchedule();
        case 5: return renderStep5();
        default: return null;
      }
    }
    switch (stepNum) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      case 6: return renderStep6();
      case 7: return renderStep7();
      case 8: return renderStep8();
      default: return null;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 16 }}>
            <Pressable
              onPress={() => stepNum > 1 ? router.back() : (isRebuild ? router.back() : (router.canGoBack() ? router.back() : router.replace('/(auth)/welcome')))}
              style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: theme.text, fontSize: 20 }}>←</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <ProgressBar step={stepNum} total={totalSteps} />
            </View>
            <Text allowFontScaling style={{ fontSize: 14, color: theme.textSecondary, width: 36, textAlign: 'right' }}>
              {stepNum}/{totalSteps}
            </Text>
          </View>

          <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {/* Step title */}
            <Text allowFontScaling style={{ fontSize: 28, fontWeight: '800', color: theme.text, marginBottom: 4 }}>
              {stepTitle.title}
            </Text>
            <Text allowFontScaling style={{ fontSize: 16, color: theme.textSecondary, marginBottom: 8 }}>
              {stepTitle.subtitle}
            </Text>

            {renderStepContent()}

            <View style={{ height: 24 }} />
          </ScrollView>

          {/* CTA */}
          <View style={{ paddingBottom: 16, paddingTop: 8 }}>
            <Pressable
              onPress={handleNext}
              disabled={!canProceed}
              style={{
                paddingVertical: 16,
                borderRadius: 16,
                alignItems: 'center',
                backgroundColor: canProceed ? theme.text : theme.border,
              }}
            >
              <Text
                allowFontScaling
                style={{ fontSize: 16, fontWeight: '600', color: canProceed ? theme.background : theme.textSecondary }}
              >
                {(isRebuild && stepNum >= REBUILD_TOTAL) ? 'Rebuild plan' : (stepNum === 8 ? 'Build my plan' : 'Continue')}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
