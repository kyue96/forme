import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  Text,
  View,
  ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SCREENS = [
  {
    icon: 'barbell' as const,
    title: 'AI-Powered Plans',
    subtitle: 'Tailored to you',
    description: 'Answer a few questions and get a personalized workout plan built just for your goals, equipment, and schedule.',
    color: '#F59E0B',
  },
  {
    icon: 'people' as const,
    title: 'Share & Connect',
    subtitle: 'With the community',
    description: 'Post your workouts, react to others, follow friends, and discover new training partners in the Forme feed.',
    color: '#3B82F6',
  },
  {
    icon: 'trophy' as const,
    title: 'Challenges & Streaks',
    subtitle: 'Stay consistent',
    description: 'Join community challenges, earn badges for consistency, and track your streaks. Built for every fitness level.',
    color: '#10B981',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleNext = () => {
    if (currentIndex < SCREENS.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      router.replace('/permissions');
    }
  };

  const handleSkip = () => {
    router.replace('/permissions');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      {/* Skip button */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingTop: 8 }}>
        <Pressable onPress={handleSkip} hitSlop={12}>
          <Text style={{ fontSize: 15, color: '#71717A' }}>Skip</Text>
        </Pressable>
      </View>

      {/* Pager */}
      <FlatList
        ref={flatListRef}
        data={SCREENS}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => (
          <View style={{
            width: SCREEN_WIDTH,
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 40,
          }}>
            {/* Icon circle */}
            <View style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: item.color + '15',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 32,
            }}>
              <Ionicons name={item.icon} size={44} color={item.color} />
            </View>

            <Text style={{
              fontSize: 28,
              fontWeight: '800',
              color: '#18181B',
              textAlign: 'center',
              marginBottom: 4,
            }}>
              {item.title}
            </Text>
            <Text style={{
              fontSize: 16,
              color: item.color,
              fontWeight: '600',
              textAlign: 'center',
              marginBottom: 16,
            }}>
              {item.subtitle}
            </Text>
            <Text style={{
              fontSize: 15,
              color: '#71717A',
              textAlign: 'center',
              lineHeight: 22,
            }}>
              {item.description}
            </Text>
          </View>
        )}
      />

      {/* Bottom section: dots + button */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 32 }}>
        {/* Dot indicators */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
          {SCREENS.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === currentIndex ? 24 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === currentIndex ? '#18181B' : '#D4D4D8',
              }}
            />
          ))}
        </View>

        {/* Next / Get Started button */}
        <Pressable
          onPress={handleNext}
          style={{
            backgroundColor: '#18181B',
            paddingVertical: 16,
            borderRadius: 16,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>
            {currentIndex === SCREENS.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
