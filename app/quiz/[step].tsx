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

const TOTAL_STEPS = 7;

const TILE_STEPS: Array<{
  key: keyof QuizAnswers;
  question: string;
  subtitle: string;
  options: string[];
}> = [
  {
    key: 'goal',
    question: "What's your goal?",
    subtitle: "We'll build your plan around this.",
    options: ['Build muscle', 'Lose fat', 'Build strength', 'Stay active'],
  },
  {
    key: 'experience',
    question: "What's your experience level?",
    subtitle: "Be honest — this helps us get it right.",
    options: ['Brand new', 'Some experience', 'Intermediate', 'Advanced'],
  },
  {
    key: 'equipment',
    question: "What equipment do you have?",
    subtitle: "We'll only include what you can actually use.",
    options: ['Full gym', 'Dumbbells only', 'Bodyweight only', 'Resistance bands'],
  },
  {
    key: 'daysPerWeek',
    question: "How many days a week?",
    subtitle: "Quality beats quantity.",
    options: ['2', '3', '4', '5+'],
  },
  {
    key: 'preferredSplit',
    question: "Preferred split?",
    subtitle: "How do you like to organise your training?",
    options: ['Push/Pull/Legs', 'Full body', 'Upper/Lower', 'Arnold split'],
  },
  {
    key: 'injuries',
    question: "Any areas to avoid?",
    subtitle: "Your safety matters most.",
    options: ['None', 'Lower back', 'Knees', 'Shoulders'],
  },
];

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
      {/* Selection highlight */}
      <View
        className="absolute left-0 right-0 bg-zinc-100 rounded-xl"
        style={{ top: ITEM_HEIGHT * 2, height: ITEM_HEIGHT } as ViewStyle}
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
              style={{ height: ITEM_HEIGHT }}
              className="items-center justify-center"
            >
              <Text
                className={`text-lg ${
                  isSelected ? 'font-bold text-zinc-900' : 'text-zinc-300'
                }`}
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

// Build height options: 4'8" to 6'10"
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

// Build weight options: 90–350 lbs
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
  const { answers, setAnswer } = useQuiz();

  const stepNum = parseInt(step ?? '1', 10);
  const isStatsStep = stepNum === TOTAL_STEPS;
  const tileConfig = TILE_STEPS[stepNum - 1];

  // Find initial indices for height/weight scroll wheels
  const initHeightIdx = answers.height
    ? HEIGHT_OPTIONS.indexOf(answers.height)
    : HEIGHT_OPTIONS.indexOf("5'9\""); // sensible default
  const initWeightIdx = answers.weight
    ? WEIGHT_OPTIONS.indexOf(answers.weight)
    : WEIGHT_OPTIONS.indexOf('170 lbs');

  const [heightIdx, setHeightIdx] = useState(Math.max(0, initHeightIdx));
  const [weightIdx, setWeightIdx] = useState(Math.max(0, initWeightIdx));

  const canProceed = isStatsStep
    ? true // scroll wheels always have a value
    : !!answers[tileConfig?.key];

  const handleNext = () => {
    if (isStatsStep) {
      setAnswer('height', HEIGHT_OPTIONS[heightIdx]);
      setAnswer('weight', WEIGHT_OPTIONS[weightIdx]);
      router.push('/plan-result');
    } else if (stepNum < TOTAL_STEPS) {
      router.push(`/quiz/${stepNum + 1}`);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 px-6 pt-4">
          {/* Header */}
          <View className="flex-row items-center mb-6 gap-4">
            <Pressable
              onPress={() => stepNum > 1 ? router.back() : router.replace('/(auth)/welcome')}
              className="w-9 h-9 items-center justify-center"
            >
              <Text className="text-zinc-900 text-xl">←</Text>
            </Pressable>
            <View className="flex-1">
              <ProgressBar step={stepNum} total={TOTAL_STEPS} />
            </View>
            <Text className="text-sm text-zinc-400 w-9 text-right">
              {stepNum}/{TOTAL_STEPS}
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
            {isStatsStep ? (
              /* Stats step — scroll wheel pickers */
              <View>
                <Text className="text-2xl font-bold text-zinc-900 mb-1">
                  A little about you
                </Text>
                <Text className="text-base text-zinc-500 mb-8">
                  Helps us calibrate the right intensity.
                </Text>

                <Text className="text-sm font-medium text-zinc-700 mb-2">
                  Height
                </Text>
                <ScrollWheelPicker
                  items={HEIGHT_OPTIONS}
                  selectedIndex={heightIdx}
                  onSelect={setHeightIdx}
                />

                <View className="h-6" />

                <Text className="text-sm font-medium text-zinc-700 mb-2">
                  Weight
                </Text>
                <ScrollWheelPicker
                  items={WEIGHT_OPTIONS}
                  selectedIndex={weightIdx}
                  onSelect={setWeightIdx}
                />
              </View>
            ) : (
              /* Tile step */
              <View>
                <Text className="text-2xl font-bold text-zinc-900 mb-1">
                  {tileConfig.question}
                </Text>
                <Text className="text-base text-zinc-500 mb-8">
                  {tileConfig.subtitle}
                </Text>

                <View>
                  {tileConfig.options.map((option) => (
                    <View key={option} className="flex-row mb-3">
                      <QuizTile
                        label={option}
                        selected={answers[tileConfig.key] === option}
                        onPress={() => setAnswer(tileConfig.key, option as never)}
                      />
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View className="h-6" />
          </ScrollView>

          {/* CTA */}
          <View className="pb-4 pt-2">
            <Pressable
              onPress={handleNext}
              disabled={!canProceed}
              className={`
                py-4 rounded-2xl items-center
                ${canProceed ? 'bg-zinc-900' : 'bg-zinc-200'}
              `}
            >
              <Text
                className={`text-base font-semibold ${canProceed ? 'text-white' : 'text-zinc-400'}`}
              >
                {isStatsStep ? 'Build my plan' : 'Continue'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
