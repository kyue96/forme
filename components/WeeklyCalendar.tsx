import { useCallback, useMemo, useRef, useState } from 'react';
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
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

export function WeeklyCalendar({ completedDays, onDayPress, planDayNames, selectedDay, onInteractionStart, onInteractionEnd }: WeeklyCalendarProps) {
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

  // Track whether TODAY pill should show: different week OR different day selected
  const showTodayPill = weekOffset !== 0 || (selectedDay != null && selectedDay !== todayStr);

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // If on a different week, animate back
    if (weekOffset !== 0) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => {
        setWeekOffset(0);
        slideAnim.setValue(0);
        Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      });
    }
    // Always re-select today
    onDayPress(today, today.getDay());
  }, [fadeAnim, slideAnim, weekOffset, onDayPress]);

  // Refs for drag-to-select
  const containerRef = useRef<View>(null);
  const containerX = useRef(0);
  const containerWidth = useRef(0);
  const dragging = useRef(false);
  const lastDragIdx = useRef(-1);
  const weekDatesRef = useRef(weekDates);
  weekDatesRef.current = weekDates;
  const onDayPressRef = useRef(onDayPress);
  onDayPressRef.current = onDayPress;
  const onInteractionStartRef = useRef(onInteractionStart);
  onInteractionStartRef.current = onInteractionStart;
  const onInteractionEndRef = useRef(onInteractionEnd);
  onInteractionEndRef.current = onInteractionEnd;

  const getDayIndexFromX = useCallback((pageX: number) => {
    const relX = pageX - containerX.current;
    const dayWidth = containerWidth.current / 7;
    const idx = Math.floor(relX / dayWidth);
    return Math.max(0, Math.min(6, idx));
  }, []);

  const panResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        const isHorizontal = Math.abs(gs.dx) > 15 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5;
        return isHorizontal;
      },
      onPanResponderGrant: (evt) => {
        dragging.current = true;
        lastDragIdx.current = -1;
        onInteractionStartRef.current?.();
        // Select the initial day
        const idx = getDayIndexFromX(evt.nativeEvent.pageX);
        lastDragIdx.current = idx;
        const dates = weekDatesRef.current;
        onDayPressRef.current(dates[idx], idx);
      },
      onPanResponderMove: (evt) => {
        if (!dragging.current) return;
        const idx = getDayIndexFromX(evt.nativeEvent.pageX);
        if (idx !== lastDragIdx.current) {
          lastDragIdx.current = idx;
          const dates = weekDatesRef.current;
          onDayPressRef.current(dates[idx], idx);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (dragging.current) {
          dragging.current = false;
          onInteractionEndRef.current?.();
          return;
        }
        // Fallback: week swipe
        if (gs.dx < -40 || (gs.vx < -0.3 && gs.dx < -10)) {
          changeWeek(1);
        } else if (gs.dx > 40 || (gs.vx > 0.3 && gs.dx > 10)) {
          changeWeek(-1);
        }
      },
      onPanResponderTerminate: () => {
        if (dragging.current) {
          dragging.current = false;
          onInteractionEndRef.current?.();
        }
      },
    }),
  [changeWeek, getDayIndexFromX]);

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
          onPress={showTodayPill ? goToToday : undefined}
          hitSlop={8}
          style={{
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 10,
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.border,
            opacity: showTodayPill ? 1 : 0,
          }}
        >
          <Text allowFontScaling style={{ fontSize: 10, fontWeight: '600', color: theme.text }}>TODAY</Text>
        </Pressable>
      </View>
      <View
        ref={containerRef}
        onLayout={() => {
          containerRef.current?.measureInWindow((x, _y, w) => {
            containerX.current = x;
            containerWidth.current = w;
          });
        }}
        {...panResponder.panHandlers}
        style={{ height: 66 }}
      >
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
                  borderWidth: isToday ? 1.5 : (isSelected ? 1.5 : 1),
                  borderColor: isToday ? dotColor : (isSelected ? theme.text : theme.border),
                }}>
                  <Text allowFontScaling style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: done ? '#22C55E' : theme.textSecondary,
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
