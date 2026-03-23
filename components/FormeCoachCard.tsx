import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '@/lib/settings-context';

const DAILY_TIPS = [
  "Your body builds muscle during rest, not during the workout. Stay hydrated, get quality sleep, and you'll come back stronger tomorrow.",
  "Progressive overload doesn't always mean more weight. Try an extra rep, a slower tempo, or a shorter rest period.",
  "Aim for 7-9 hours of sleep. Growth hormone peaks during deep sleep \u2014 that's when real recovery happens.",
  "Don't skip your warm-up. 5 minutes of light movement can prevent weeks of injury setback.",
  "Protein timing matters less than total daily intake. Aim for 1.6-2.2g per kg of bodyweight spread across meals.",
  "Foam rolling for 5-10 minutes post-workout can reduce soreness and improve range of motion for your next session.",
  "Creatine monohydrate is one of the most studied and effective supplements. 3-5g daily is all you need.",
  "Feeling sore doesn't mean your workout was effective. Consistency and progressive overload matter more than soreness.",
  "Deload weeks aren't a sign of weakness. Reducing intensity every 4-6 weeks helps prevent burnout and overtraining.",
  "Mind-muscle connection is real. Slow down your reps and focus on the muscle you're targeting for better results.",
  "Water makes up 75% of muscle tissue. Even 2% dehydration can decrease your strength by up to 20%.",
  "Compound movements like squats, deadlifts, and bench press give you the most bang for your buck. Prioritize them.",
  "Stretching after your workout when muscles are warm is more effective than stretching cold muscles before training.",
  "Track your workouts consistently. What gets measured gets managed \u2014 and what gets managed gets improved.",
  "Rest between sets matters. 2-3 minutes for strength, 60-90 seconds for hypertrophy, 30-60 seconds for endurance.",
  "Your grip strength is often the first thing to fail. Train it directly and watch your other lifts improve.",
  "Walking 8,000-10,000 steps daily improves recovery, heart health, and helps manage body composition without taxing your muscles.",
  "Caffeine 30 minutes before a workout can boost performance by 3-5%. But avoid it within 8 hours of bedtime.",
  "Don't compare your progress to others. The only competition that matters is who you were yesterday.",
  "Consistency beats perfection. A mediocre workout you actually do is better than the perfect one you skip.",
  "Magnesium supports over 300 biochemical reactions including muscle function. Most people don't get enough from diet alone.",
  "Train your weakest muscle group first in your session when energy is highest. Weak points only improve when prioritized.",
  "Cold showers for 2-3 minutes post-workout can reduce inflammation and speed up recovery between sessions.",
  "Eating within 2 hours after training helps replenish glycogen stores. Pair protein with carbs for best results.",
  "Hip mobility work for 5 minutes daily can improve your squat depth and reduce lower back strain over time.",
  "Stress raises cortisol, which breaks down muscle and stores fat. Find one daily habit that helps you decompress.",
  "Unilateral exercises like single-leg squats and lunges expose and correct strength imbalances between sides.",
  "Your nervous system needs recovery too. If you feel mentally drained, a lighter session is smarter than forcing intensity.",
  "Fiber slows digestion and keeps you full longer. Aim for 25-35g daily from vegetables, fruits, and whole grains.",
  "Breathing through your nose during warm-ups activates your parasympathetic system and improves oxygen efficiency.",
  "Eccentric training \u2014 slowing the lowering phase of a lift \u2014 builds more strength and reduces injury risk.",
  "Ankle mobility limits more lifts than you think. Spend 2 minutes daily on calf stretches and ankle circles.",
  "Electrolytes aren't just for endurance athletes. Sodium, potassium, and magnesium support every muscle contraction.",
  "Take at least one full rest day per week. Active recovery like a light walk counts \u2014 complete inactivity doesn't.",
  "Visualize your sets before you perform them. Mental rehearsal activates the same neural pathways as physical practice.",
  "Omega-3 fatty acids reduce exercise-induced inflammation. Get them from fatty fish, walnuts, or a quality supplement.",
  "Your core works hardest during compound lifts. Dedicated core work should complement, not replace, heavy training.",
  "Small wins compound over time. One percent better each week adds up to a completely different you in a year.",
  "Thoracic spine mobility affects your overhead press, bench, and posture. Foam roll your upper back regularly.",
  "Sleep quality matters as much as duration. Keep your room cool, dark, and screen-free for the last 30 minutes before bed.",
];

function getDayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

interface FormeCoachCardProps {
  message?: string;
  compact?: boolean;
}

export default function FormeCoachCard({
  message,
  compact = true,
}: FormeCoachCardProps) {
  const dayOfYear = getDayOfYear();
  const todayTip = message ?? DAILY_TIPS[dayOfYear % DAILY_TIPS.length];
  const { theme } = useSettings();
  const [expanded, setExpanded] = useState(false);

  if (compact && !expanded) {
    return (
      <Pressable
        onPress={() => setExpanded(true)}
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
          },
        ]}
      >
        <Ionicons name="bulb-outline" size={16} color={theme.chrome} />
        <Text
          style={{ fontSize: 13, fontWeight: '600', color: theme.text, marginLeft: 8, flex: 1 }}
          numberOfLines={1}
        >
          Daily Tip
        </Text>
        <Ionicons name="chevron-down" size={14} color={theme.chrome} style={{ marginLeft: 4 }} />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={compact ? () => setExpanded(false) : undefined}
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: theme.background, borderColor: theme.border },
          ]}
        >
          <Ionicons name="bulb-outline" size={16} color={theme.textSecondary} />
        </View>
        <View style={[styles.headerText, { flex: 1 }]}>
          <Text style={[styles.label, { color: theme.text }]}>Daily Tip</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Powered by Forme
          </Text>
        </View>
        {compact && (
          <Ionicons name="chevron-up" size={14} color={theme.chrome} />
        )}
      </View>

      {/* Message bubble */}
      <View
        style={[
          styles.bubble,
          { backgroundColor: theme.background, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.bubbleText, { color: theme.text }]}>
          {todayTip}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerText: {
    marginLeft: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  bubble: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  bubbleText: {
    fontSize: 13,
    lineHeight: 19,
  },
});
