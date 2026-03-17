import { useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProgressBar } from '@/components/ProgressBar';
import { QuizTile } from '@/components/QuizTile';
import { useQuiz } from '@/lib/quiz-store';
import { QuizAnswers } from '@/lib/types';
import { useSettings } from '@/lib/settings-context';
import { animateLayout } from '@/lib/utils';

const TOTAL_STEPS = 10;

type TileStep = {
  key: keyof QuizAnswers;
  question: string;
  subtitle: string;
  options: string[];
  multiSelect?: boolean;
};

const TILE_STEPS: TileStep[] = [
  {
    key: 'gender',
    question: "What's your gender?",
    subtitle: "Helps us personalize your plan.",
    options: ['Male', 'Female'],
  },
  // Step 2 = age (handled separately)
  {
    key: 'goal',
    question: "What are your goals?",
    subtitle: "Select all that apply.",
    options: ['Build muscle', 'Build strength', 'Lose weight', 'Stay active'],
    multiSelect: true,
  },
  {
    key: 'experience',
    question: "What's your experience level?",
    subtitle: "Be honest — this helps us get it right.",
    options: ['Beginner', 'Some experience', 'Intermediate', 'Advanced'],
  },
  {
    key: 'equipment',
    question: "What equipment do you have?",
    subtitle: "Select all that apply.",
    options: ['Full gym', 'Dumbbells', 'Resistance bands', 'None'],
    multiSelect: true,
  },
  {
    key: 'daysPerWeek',
    question: "How many days per week do you want to work out?",
    subtitle: "Quality beats quantity.",
    options: ['2', '3', '4', '5+'],
  },
  {
    key: 'workoutDuration',
    question: "How long per workout?",
    subtitle: "We'll fit everything into your window.",
    options: ['30 min', '45 min', '60 min', '90 min'],
  },
  {
    key: 'preferredSplit',
    question: "Preferred split?",
    subtitle: "A 'split' is how you divide muscle groups across your workout days.",
    options: ['Push/Pull/Legs', 'Full body', 'Upper/Lower'],
  },
  {
    key: 'routineChoice',
    question: "Custom or AI routine?",
    subtitle: "Let us build it, or do it yourself.",
    options: ['Generate my plan', "I'll build my own"],
  },
];

// Step 9 = body stats (height, current weight)
// Step 10 = injuries
const INJURIES_STEP: TileStep = {
  key: 'injuries',
  question: "Any areas to avoid?",
  subtitle: "Your safety matters most.",
  options: ['None', 'Lower back', 'Knees', 'Shoulders'],
};

// Mapping from stepNum to the tile step config
// Steps: 1=gender, 2=age, 3=goal, 4=experience, 5=equipment, 6=days, 7=duration, 8=split, 9=body stats, 10=injuries
// But routineChoice was step 8 and is now step 8 = split... let me re-map:
// TILE_STEPS[0] = gender (step 1)
// step 2 = age (custom)
// TILE_STEPS[1] = goal (step 3)
// TILE_STEPS[2] = experience (step 4)
// TILE_STEPS[3] = equipment (step 5)
// TILE_STEPS[4] = daysPerWeek (step 6)
// TILE_STEPS[5] = duration (step 7)
// TILE_STEPS[6] = split (step 8)
// step 9 = body stats (custom)
// step 10 = injuries

function getTileConfig(stepNum: number): TileStep | null {
  if (stepNum === 1) return TILE_STEPS[0]; // gender
  if (stepNum === 2) return null; // age (custom)
  if (stepNum === 3) return TILE_STEPS[1]; // goal
  if (stepNum === 4) return TILE_STEPS[2]; // experience
  if (stepNum === 5) return TILE_STEPS[3]; // equipment
  if (stepNum === 6) return TILE_STEPS[4]; // daysPerWeek
  if (stepNum === 7) return TILE_STEPS[5]; // duration
  if (stepNum === 8) return TILE_STEPS[6]; // split
  if (stepNum === 9) return null; // body stats (custom)
  if (stepNum === 10) return INJURIES_STEP;
  return null;
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

// Age range
const MIN_AGE = 16;
const MAX_AGE = 80;

export default function QuizStepScreen() {
  const { step } = useLocalSearchParams<{ step: string }>();
  const router = useRouter();
  const { answers, setAnswer, toggleEquipment, toggleGoal } = useQuiz();
  const { theme } = useSettings();

  const stepNum = parseInt(step ?? '1', 10);
  const isAgeStep = stepNum === 2;
  const isStatsStep = stepNum === 9;
  const isInjuriesStep = stepNum === 10;
  const tileConfig = getTileConfig(stepNum);

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

  const canProceed = (() => {
    if (isStatsStep) return true;
    if (isAgeStep) return true;
    if (!tileConfig) return false;
    if (tileConfig.multiSelect) {
      const arr = answers[tileConfig.key] as unknown[];
      return arr && arr.length > 0;
    }
    return !!answers[tileConfig.key];
  })();

  const handleNext = () => {
    animateLayout();
    if (isAgeStep) {
      setAnswer('age', ageValue);
      router.push(`/quiz/${stepNum + 1}`);
    } else if (isStatsStep) {
      setAnswer('height', HEIGHT_OPTIONS[heightIdx]);
      setAnswer('weight', WEIGHT_OPTIONS[weightIdx]);
      router.push(`/quiz/${stepNum + 1}`);
    } else if (isInjuriesStep) {
      router.push('/plan-result');
    } else if (stepNum < TOTAL_STEPS) {
      router.push(`/quiz/${stepNum + 1}`);
    }
  };

  const isOptionSelected = (option: string): boolean => {
    if (!tileConfig) return false;
    if (tileConfig.multiSelect) {
      const arr = (answers[tileConfig.key] as unknown as string[] | undefined) ?? [];
      return arr.includes(option);
    }
    return answers[tileConfig.key] === option;
  };

  const handleTilePress = (option: string) => {
    if (!tileConfig) return;
    if (tileConfig.multiSelect) {
      if (tileConfig.key === 'goal') {
        toggleGoal(option);
      } else {
        toggleEquipment(option);
      }
    } else {
      setAnswer(tileConfig.key, option as never);
    }
  };

  // Age stepper render (−/+ buttons)
  const renderAgeStep = () => {
    return (
      <View>
        <Text allowFontScaling style={{ fontSize: 24, fontWeight: '700', color: theme.text, marginBottom: 4 }}>
          How old are you?
        </Text>
        <Text allowFontScaling style={{ fontSize: 16, color: theme.textSecondary, marginBottom: 32 }}>
          Helps us tailor intensity and recovery.
        </Text>

        {/* Large age display with −/+ buttons */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 24 }}>
          <Pressable
            onPress={() => setAgeValue(Math.max(MIN_AGE, ageValue - 1))}
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 28, fontWeight: '600', color: theme.text }}>−</Text>
          </Pressable>

          <Text allowFontScaling style={{ fontSize: 64, fontWeight: '800', color: theme.text, minWidth: 100, textAlign: 'center' }}>
            {ageValue}
          </Text>

          <Pressable
            onPress={() => setAgeValue(Math.min(MAX_AGE, ageValue + 1))}
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 28, fontWeight: '600', color: theme.text }}>+</Text>
          </Pressable>
        </View>
      </View>
    );
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
              onPress={() => stepNum > 1 ? router.back() : router.replace('/(auth)/welcome')}
              style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: theme.text, fontSize: 20 }}>←</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <ProgressBar step={stepNum} total={TOTAL_STEPS} />
            </View>
            <Text allowFontScaling style={{ fontSize: 14, color: theme.textSecondary, width: 36, textAlign: 'right' }}>
              {stepNum}/{TOTAL_STEPS}
            </Text>
          </View>

          <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {isAgeStep ? (
              renderAgeStep()
            ) : isStatsStep ? (
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Text allowFontScaling style={{ fontSize: 24, fontWeight: '700', color: theme.text }}>
                    Body stats
                  </Text>
                  <View style={{ backgroundColor: theme.surface, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary }}>Optional</Text>
                  </View>
                </View>
                <Text allowFontScaling style={{ fontSize: 16, color: theme.textSecondary, marginBottom: 32 }}>
                  Helps us calibrate the right intensity.
                </Text>

                <Text allowFontScaling style={{ fontSize: 14, fontWeight: '500', color: theme.text, marginBottom: 8 }}>Height</Text>
                <ScrollWheelPicker items={HEIGHT_OPTIONS} selectedIndex={heightIdx} onSelect={setHeightIdx} />
                <View style={{ height: 16 }} />

                <Text allowFontScaling style={{ fontSize: 14, fontWeight: '500', color: theme.text, marginBottom: 8 }}>Current weight</Text>
                <ScrollWheelPicker items={WEIGHT_OPTIONS} selectedIndex={weightIdx} onSelect={setWeightIdx} />

                <Pressable
                  onPress={() => router.push(`/quiz/${stepNum + 1}`)}
                  style={{ marginTop: 20, alignItems: 'center', paddingVertical: 12 }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '500', color: theme.textSecondary }}>Skip this step</Text>
                </Pressable>
              </View>
            ) : tileConfig ? (
              <View>
                <Text allowFontScaling style={{ fontSize: 24, fontWeight: '700', color: theme.text, marginBottom: 4 }}>
                  {tileConfig.question}
                </Text>
                <Text allowFontScaling style={{ fontSize: 16, color: theme.textSecondary, marginBottom: 32 }}>
                  {tileConfig.subtitle}
                </Text>
                <View>
                  {tileConfig.options.map((option) => (
                    <View key={option} style={{ flexDirection: 'row', marginBottom: 12 }}>
                      <QuizTile
                        label={option}
                        selected={isOptionSelected(option)}
                        onPress={() => handleTilePress(option)}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
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
                {isInjuriesStep ? 'Build my plan' : 'Continue'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
