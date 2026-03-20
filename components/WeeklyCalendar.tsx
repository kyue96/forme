import { useCallback, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, Text, View } from 'react-native';
import { useSettings } from '@/lib/settings-context';
import { useUserStore } from '@/lib/user-store';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function getWeekDates(weekOffset: number = 0): Date[] {
  const now = new Date();
  const dow = now.getDay();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - dow + weekOffset * 7);
  sunday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d;
  });
}

export function dateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getMonthLabel(dates: Date[]): string {
  const first = dates[0];
  const last = dates[6];
  const firstMonth = first.toLocaleDateString('en-US', { month: 'long' });
  const lastMonth = last.toLocaleDateString('en-US', { month: 'long' });
  if (firstMonth === lastMonth) {
    return firstMonth;
  }
  const firstShort = first.toLocaleDateString('en-US', { month: 'short' });
  const lastShort = last.toLocaleDateString('en-US', { month: 'short' });
  return `${firstShort} – ${lastShort}`;
}

interface WeeklyCalendarProps {
  completedDays: Set<string>;
  onDayPress: (date: Date, dayIndex: number) => void;
  planDayNames?: Set<string>;
  selectedDay?: string;
}

export function WeeklyCalendar({ completedDays, onDayPress, planDayNames, selectedDay }: WeeklyCalendarProps) {
  const { theme } = useSettings();
  const avatarColor = useUserStore((s) => s.avatarColor);
  const dotColor = avatarColor || '#F59E0B';
  const [weekOffset, setWeekOffset] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const swiping = useRef(false);

  const weekDates = getWeekDates(weekOffset);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const todayStr = dateKey(now);

  const changeWeek = useCallback((direction: 1 | -1) => {
    if (swiping.current) return;
    swiping.current = true;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -direction * 40, duration: 100, useNativeDriver: true }),
    ]).start(() => {
      setWeekOffset((prev) => prev + direction);
      slideAnim.setValue(direction * 40);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 200, friction: 20 }),
      ]).start(() => {
        swiping.current = false;
      });
    });
  }, [fadeAnim, slideAnim]);

  const goToToday = useCallback(() => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => {
      setWeekOffset(0);
      slideAnim.setValue(0);
      Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    });
  }, [fadeAnim, slideAnim]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 20 && Math.abs(gs.dx) > Math.abs(gs.dy) * 2,
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -40 || (gs.vx < -0.3 && gs.dx < -10)) {
          changeWeek(1);
        } else if (gs.dx > 40 || (gs.vx > 0.3 && gs.dx > 10)) {
          changeWeek(-1);
        }
      },
    })
  ).current;

  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 16, marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text allowFontScaling style={{
          fontSize: 14,
          fontWeight: '700',
          color: theme.text,
        }}>
          {getMonthLabel(weekDates)}
        </Text>
        <Pressable
          onPress={weekOffset !== 0 ? goToToday : undefined}
          hitSlop={8}
          style={{
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 10,
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.border,
            opacity: weekOffset !== 0 ? 1 : 0,
          }}
        >
          <Text allowFontScaling style={{ fontSize: 10, fontWeight: '600', color: theme.text }}>Today</Text>
        </Pressable>
      </View>
      <View {...panResponder.panHandlers} style={{ height: 66 }}>
        <Animated.View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          opacity: fadeAnim,
          transform: [{ translateX: slideAnim }],
        }}>
          {weekDates.map((date, i) => {
            const dk = dateKey(date);
            const isToday = dk === todayStr;
            const isSelected = selectedDay != null && dk === selectedDay;
            const done = completedDays.has(dk);

            return (
              <Pressable key={dk} style={{ alignItems: 'center' }} onPress={() => onDayPress(date, i)}>
                <Text allowFontScaling style={{
                  fontSize: 11,
                  marginBottom: 6,
                  fontWeight: isToday ? '700' : '400',
                  color: isToday ? theme.text : theme.textSecondary,
                }}>
                  {DAY_LABELS[i]}
                </Text>
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.surface,
                  borderWidth: isToday ? 2 : (isSelected ? 1.5 : 1),
                  borderColor: isToday ? dotColor : (isSelected ? theme.text : theme.border),
                }}>
                  <Text allowFontScaling style={{
                    fontSize: 13,
                    fontWeight: isToday ? '800' : '600',
                    color: done ? '#22C55E' : (isToday ? dotColor : theme.textSecondary),
                  }}>
                    {date.getDate()}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </Animated.View>
      </View>
    </View>
  );
}
