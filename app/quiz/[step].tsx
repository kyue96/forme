import { useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  KeyboardAvoidingView,
  LayoutAnimation,
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

const TOTAL_STEPS = 11;

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
  {
    key: 'goal',
    question: "What's your goal?",
    subtitle: "We'll build your plan around this.",
    options: ['Build muscle', 'Build strength', 'Lose weight', 'Stay active'],
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
    options: ['Full gym', 'Dumbbells', 'Resistance bands', 'Bodyweight'],
    multiSelect: true,
  },
  {
    key: 'daysPerWeek',
    question: "How many days a week do you want to train?",
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
    subtitle: "How do you like to organise your training?",
    options: ['Push/Pull/Legs', 'Full body', 'Upper/Lower'],
  },
  {
    key: 'routineChoice',
    question: "Custom or AI routine?",
    subtitle: "Let us build it, or do it yourself.",
    options: ['Generate my plan', "I'll build my own"],
  },
  {
    key: 'mealsPerDay',
    question: "How many meals per day?",
    subtitle: "Helps us plan your nutrition.",
    options: ['2', '3', '4', '5+'],
  },
];

// Step 10 = body stats (height, current weight, goal weight)
// Step 11 = injuries
const INJURIES_STEP: TileStep = {
  key: 'injuries',
  question: "Any areas to avoid?",
  subtitle: "Your safety matters most.",
  options: ['None', 'Lower back', 'Knees', 'Shoulders'],
};

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

export default function QuizStepScreen() {
  const { step } = useLocalSearchParams<{ step: string }>();
  const router = useRouter();
  const { answers, setAnswer, toggleEquipment } = useQuiz();
  const { theme } = useSettings();

  const stepNum = parseInt(step ?? '1', 10);
  const isStatsStep = stepNum === 10;
  const isInjuriesStep = stepNum === 11;
  const tileConfig = stepNum <= 9 ? TILE_STEPS[stepNum - 1] : isInjuriesStep ? INJURIES_STEP : null;

  const initHeightIdx = answers.height
    ? HEIGHT_OPTIONS.indexOf(answers.height)
    : HEIGHT_OPTIONS.indexOf("5'9\"");
  const initWeightIdx = answers.weight
    ? WEIGHT_OPTIONS.indexOf(answers.weight)
    : WEIGHT_OPTIONS.indexOf('170 lbs');
  const initGoalWeightIdx = answers.goalWeight
    ? WEIGHT_OPTIONS.indexOf(answers.goalWeight)
    : WEIGHT_OPTIONS.indexOf('160 lbs');

  const [heightIdx, setHeightIdx] = useState(Math.max(0, initHeightIdx));
  const [weightIdx, setWeightIdx] = useState(Math.max(0, initWeightIdx));
  const [goalWeightIdx, setGoalWeightIdx] = useState(Math.max(0, initGoalWeightIdx));

  const canProceed = (() => {
    if (isStatsStep) return true;
    if (!tileConfig) return false;
    if (tileConfig.multiSelect) {
      const arr = answers[tileConfig.key] as unknown[];
      return arr && arr.length > 0;
    }
    return !!answers[tileConfig.key];
  })();

  const handleNext = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (isStatsStep) {
      setAnswer('height', HEIGHT_OPTIONS[heightIdx]);
      setAnswer('weight', WEIGHT_OPTIONS[weightIdx]);
      setAnswer('goalWeight', WEIGHT_OPTIONS[goalWeightIdx]);
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
      toggleEquipment(option);
    } else {
      setAnswer(tileConfig.key, option as never);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {isStatsStep ? (
              <View>
                <Text allowFontScaling style={{ fontSize: 24, fontWeight: '700', color: theme.text, marginBottom: 4 }}>
                  Body stats
                </Text>
                <Text allowFontScaling style={{ fontSize: 16, color: theme.textSecondary, marginBottom: 32 }}>
                  Helps us calibrate the right intensity.
                </Text>

                <Text allowFontScaling style={{ fontSize: 14, fontWeight: '500', color: theme.text, marginBottom: 8 }}>Height</Text>
                <ScrollWheelPicker items={HEIGHT_OPTIONS} selectedIndex={heightIdx} onSelect={setHeightIdx} />
                <View style={{ height: 16 }} />

                <Text allowFontScaling style={{ fontSize: 14, fontWeight: '500', color: theme.text, marginBottom: 8 }}>Current weight</Text>
                <ScrollWheelPicker items={WEIGHT_OPTIONS} selectedIndex={weightIdx} onSelect={setWeightIdx} />
                <View style={{ height: 16 }} />

                <Text allowFontScaling style={{ fontSize: 14, fontWeight: '500', color: theme.text, marginBottom: 8 }}>Goal weight</Text>
                <ScrollWheelPicker items={WEIGHT_OPTIONS} selectedIndex={goalWeightIdx} onSelect={setGoalWeightIdx} />
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
