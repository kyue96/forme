import { Pressable, Text, View } from 'react-native';
import { useSettings } from '@/lib/settings-context';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function getWeekDates(): Date[] {
  const now = new Date();
  const dow = now.getDay();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - dow);
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

interface WeeklyCalendarProps {
  completedDays: Set<string>;
  onDayPress: (date: Date, dayIndex: number) => void;
  planDayNames?: Set<string>;
  selectedDay?: string;
}

export function WeeklyCalendar({ completedDays, onDayPress, planDayNames, selectedDay }: WeeklyCalendarProps) {
  const { theme } = useSettings();
  const weekDates = getWeekDates();
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const todayStr = dateKey(now);

  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 16, marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {weekDates.map((date, i) => {
          const dk = dateKey(date);
          const isToday = dk === todayStr;
          const isSelected = selectedDay != null && dk === selectedDay;
          const done = completedDays.has(dk);
          const isWorkDay = planDayNames ? planDayNames.has(DAY_NAMES_FULL[i].toLowerCase()) : true;
          const isPast = date < now && !isToday;

          const circleSize = isToday ? 40 : 36;
          let circleBg = theme.surface;
          let borderStyle: object = { borderWidth: 1, borderColor: theme.border };
          if (isToday) { circleBg = theme.text; borderStyle = {}; }
          else if (isSelected) { circleBg = theme.surface; borderStyle = { borderWidth: 2, borderColor: theme.text }; }
          else if (!isWorkDay) { circleBg = theme.surface; borderStyle = {}; }
          else if (isPast) { circleBg = theme.surface; }

          return (
            <Pressable key={i} style={{ alignItems: 'center' }} onPress={() => onDayPress(date, i)}>
              <Text allowFontScaling style={{
                fontSize: 11,
                marginBottom: 6,
                fontWeight: isToday ? '700' : '400',
                color: isToday ? theme.text : theme.textSecondary,
              }}>
                {DAY_LABELS[i]}
              </Text>
              <View style={{
                width: circleSize,
                height: circleSize,
                borderRadius: circleSize / 2,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: circleBg,
                ...borderStyle,
              }}>
                <Text allowFontScaling style={{
                  fontSize: isToday ? 14 : 13,
                  fontWeight: isToday ? '800' : '600',
                  color: done ? '#22C55E' : isToday ? theme.background : !isWorkDay ? theme.border : theme.textSecondary,
                }}>
                  {date.getDate()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
