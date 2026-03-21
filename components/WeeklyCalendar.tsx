import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, LayoutAnimation, PanResponder, Platform, Pressable, Text, UIManager, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '@/lib/settings-context';
import { useUserStore } from '@/lib/user-store';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LABELS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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

/** Get all weeks (rows) for a given month */
function getMonthWeeks(year: number, month: number): Date[][] {
  const weeks: Date[][] = [];
  // Find the Sunday of the week containing the 1st
  const first = new Date(year, month, 1);
  const startSunday = new Date(first);
  startSunday.setDate(first.getDate() - first.getDay());

  let current = new Date(startSunday);
  // Generate up to 6 weeks
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    // Only include if at least one day is in the target month
    if (week.some((d) => d.getMonth() === month)) {
      weeks.push(week);
    }
  }
  return weeks;
}

/** Find which week offset corresponds to a given date */
function weekOffsetForDate(date: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const nowDow = now.getDay();
  const thisSunday = new Date(now);
  thisSunday.setDate(now.getDate() - nowDow);

  const targetDow = date.getDay();
  const targetSunday = new Date(date);
  targetSunday.setDate(date.getDate() - targetDow);
  targetSunday.setHours(0, 0, 0, 0);

  const diffMs = targetSunday.getTime() - thisSunday.getTime();
  return Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
}

interface WeeklyCalendarProps {
  completedDays: Set<string>;
  onDayPress: (date: Date, dayIndex: number) => void;
  planDayNames?: Set<string>;
  selectedDay?: string;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
  onWeekChange?: (weekMidDate: Date) => void;
}

export function WeeklyCalendar({ completedDays, onDayPress, planDayNames, selectedDay, onInteractionStart, onInteractionEnd, onWeekChange }: WeeklyCalendarProps) {
  const { theme } = useSettings();
  const avatarColor = useUserStore((s) => s.avatarColor);
  const createdAt = useUserStore((s) => s.createdAt);
  // Earliest allowed month — the month the user created their account
  const minDate = useMemo(() => {
    if (!createdAt) return null;
    const d = new Date(createdAt);
    return { year: d.getFullYear(), month: d.getMonth() };
  }, [createdAt]);
  const dotColor = avatarColor || '#F59E0B';
  const [weekOffset, setWeekOffset] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const swiping = useRef(false);

  const weekDates = getWeekDates(weekOffset);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const todayStr = dateKey(now);

  // Month view data — based on the middle of the current week to handle cross-month weeks
  const midWeekDate = weekDates[3]; // Wednesday
  const [viewMonth, setViewMonth] = useState({ year: midWeekDate.getFullYear(), month: midWeekDate.getMonth() });
  const monthWeeks = useMemo(() => getMonthWeeks(viewMonth.year, viewMonth.month), [viewMonth.year, viewMonth.month]);
  const monthLabel = expanded
    ? new Date(viewMonth.year, viewMonth.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : getMonthLabel(weekDates);

  // Track whether TODAY pill should show: different week OR different day selected
  const showTodayPill = weekOffset !== 0 || (selectedDay != null && selectedDay !== todayStr);

  const animateExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  const toggleExpanded = useCallback(() => {
    animateExpand();
    if (!expanded) {
      // Sync month view to current week
      const mid = weekDates[3];
      setViewMonth({ year: mid.getFullYear(), month: mid.getMonth() });
    }
    setExpanded((prev) => !prev);
  }, [expanded, weekDates]);

  const changeMonth = useCallback((direction: 1 | -1) => {
    setViewMonth((prev) => {
      let m = prev.month + direction;
      let y = prev.year;
      if (m > 11) { m = 0; y++; }
      if (m < 0) { m = 11; y--; }
      // Block going before account creation month
      if (minDate && (y < minDate.year || (y === minDate.year && m < minDate.month))) {
        return prev;
      }
      animateExpand();
      return { year: y, month: m };
    });
  }, [minDate]);

  const selectDayFromMonth = useCallback((date: Date) => {
    const offset = weekOffsetForDate(date);
    animateExpand();
    setWeekOffset(offset);
    setExpanded(false);
    onDayPress(date, date.getDay());
  }, [onDayPress]);

  const onWeekChangeRef = useRef(onWeekChange);
  onWeekChangeRef.current = onWeekChange;

  const changeWeek = useCallback((direction: 1 | -1) => {
    if (swiping.current) return;
    // Block swiping before account creation week
    if (direction === -1 && minDate) {
      const nextWeekDates = getWeekDates(weekOffset + direction);
      const lastDay = nextWeekDates[6]; // Saturday of that week
      if (lastDay.getFullYear() < minDate.year ||
          (lastDay.getFullYear() === minDate.year && lastDay.getMonth() < minDate.month)) {
        return;
      }
    }
    const newOffset = weekOffset + direction;
    const newWeekDates = getWeekDates(newOffset);
    swiping.current = true;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -direction * 40, duration: 100, useNativeDriver: true }),
    ]).start(() => {
      setWeekOffset(newOffset);
      onWeekChangeRef.current?.(newWeekDates[3]); // mid-week Wednesday
      slideAnim.setValue(direction * 40);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 200, friction: 20 }),
      ]).start(() => {
        swiping.current = false;
      });
    });
  }, [fadeAnim, slideAnim, minDate, weekOffset]);

  const goToToday = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (expanded) {
      animateExpand();
      setExpanded(false);
    }
    if (weekOffset !== 0) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => {
        setWeekOffset(0);
        onWeekChangeRef.current?.(new Date()); // reset to current week
        slideAnim.setValue(0);
        Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      });
    }
    onDayPress(today, today.getDay());
  }, [fadeAnim, slideAnim, weekOffset, onDayPress, expanded]);

  // Swipe to change week
  const containerRef = useRef<View>(null);
  const onInteractionStartRef = useRef(onInteractionStart);
  onInteractionStartRef.current = onInteractionStart;
  const onInteractionEndRef = useRef(onInteractionEnd);
  onInteractionEndRef.current = onInteractionEnd;
  const changeWeekRef = useRef(changeWeek);
  changeWeekRef.current = changeWeek;

  const panResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        return Math.abs(gs.dx) > 15 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5;
      },
      onPanResponderGrant: () => {
        onInteractionStartRef.current?.();
      },
      onPanResponderRelease: (_, gs) => {
        onInteractionEndRef.current?.();
        if (gs.dx < -40 || (gs.vx < -0.3 && gs.dx < -10)) {
          changeWeekRef.current(1);
        } else if (gs.dx > 40 || (gs.vx > 0.3 && gs.dx > 10)) {
          changeWeekRef.current(-1);
        }
      },
      onPanResponderTerminate: () => {
        onInteractionEndRef.current?.();
      },
    }),
  []);

  const renderDayCell = (date: Date, isCurrentMonth: boolean = true) => {
    const dk = dateKey(date);
    const isToday = dk === todayStr;
    const isSelected = selectedDay != null && dk === selectedDay;
    const done = completedDays.has(dk);

    return (
      <Pressable
        key={dk}
        style={{ alignItems: 'center', flex: 1 }}
        onPress={() => expanded ? selectDayFromMonth(date) : onDayPress(date, date.getDay())}
      >
        {!expanded && (
          <Text allowFontScaling style={{
            fontSize: 10,
            marginBottom: 4,
            fontWeight: isToday ? '700' : '600',
            color: theme.text,
            opacity: isToday ? 1 : 0.7,
          }}>
            {DAY_LABELS_SHORT[date.getDay()]}
          </Text>
        )}
        <View style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.surface,
          borderWidth: isToday ? 1.5 : (isSelected ? 1.5 : 1),
          borderColor: isToday ? dotColor : (isSelected ? theme.text : theme.border),
          opacity: isCurrentMonth ? 1 : 0.3,
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
  };

  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 12, marginBottom: 12 }}>
      {expanded ? (
        /* Expanded month view */
        <View>
          {/* Header row for expanded: month nav + TODAY + collapse */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable
                onPress={() => changeMonth(-1)}
                hitSlop={12}
                style={{ opacity: minDate && (viewMonth.year === minDate.year && viewMonth.month === minDate.month) ? 0.2 : 1 }}
                disabled={!!(minDate && viewMonth.year === minDate.year && viewMonth.month === minDate.month)}
              >
                <Ionicons name="chevron-back" size={18} color={theme.textSecondary} />
              </Pressable>
              <Text allowFontScaling style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>
                {monthLabel}
              </Text>
              <Pressable onPress={() => changeMonth(1)} hitSlop={12}>
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {showTodayPill && (
                <Pressable
                  onPress={goToToday}
                  hitSlop={8}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 10,
                    backgroundColor: theme.surface,
                    borderWidth: 1,
                    borderColor: theme.border,
                  }}
                >
                  <Text allowFontScaling style={{ fontSize: 10, fontWeight: '600', color: theme.text }}>TODAY</Text>
                </Pressable>
              )}
              <Pressable onPress={toggleExpanded} hitSlop={8}>
                <Ionicons name="chevron-up" size={18} color={dotColor} />
              </Pressable>
            </View>
          </View>
          {/* Day labels header */}
          <View style={{ flexDirection: 'row', marginBottom: 8 }}>
            {DAY_LABELS.map((label) => (
              <Text key={label} allowFontScaling style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 11,
                fontWeight: '400',
                color: theme.textSecondary,
              }}>
                {label}
              </Text>
            ))}
          </View>
          {/* Week rows */}
          {monthWeeks.map((week, wi) => (
            <View key={wi} style={{ flexDirection: 'row', marginBottom: 8 }}>
              {week.map((date) => renderDayCell(date, date.getMonth() === viewMonth.month))}
            </View>
          ))}
        </View>
      ) : (
        /* Collapsed week view — month label inline with circles */
        <View
          ref={containerRef}
          {...panResponder.panHandlers}
          style={{ flexDirection: 'row', alignItems: 'flex-start', height: 60 }}
        >
          <View style={{ marginRight: 12, alignItems: 'flex-start', paddingTop: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text allowFontScaling style={{ fontSize: 13, fontWeight: '700', color: theme.text }} numberOfLines={1}>
                {monthLabel}
              </Text>
              <Pressable onPress={toggleExpanded} hitSlop={8}>
                <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
              </Pressable>
            </View>
            {showTodayPill && (
              <Pressable
                onPress={goToToday}
                hitSlop={8}
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 8,
                  backgroundColor: theme.surface,
                  borderWidth: 1,
                  borderColor: theme.border,
                  marginTop: 8,
                }}
              >
                <Text allowFontScaling style={{ fontSize: 9, fontWeight: '600', color: theme.text }}>TODAY</Text>
              </Pressable>
            )}
          </View>
          <Animated.View style={{
            flex: 1,
            flexDirection: 'row',
            justifyContent: 'space-between',
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }],
          }}>
            {weekDates.map((date) => renderDayCell(date))}
          </Animated.View>
        </View>
      )}
    </View>
  );
}
