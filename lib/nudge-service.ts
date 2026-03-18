import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const NUDGE_KEY = '@forme/nudges-enabled';
const LAST_NUDGE_KEY = '@forme/last-nudge-check';

export async function isNudgeEnabled(): Promise<boolean> {
  const val = await AsyncStorage.getItem(NUDGE_KEY);
  return val !== 'false'; // enabled by default
}

export async function setNudgeEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(NUDGE_KEY, String(enabled));
}

/**
 * Check if user has been inactive (3+ days since last workout)
 * and schedule a push notification nudge.
 */
export async function checkAndScheduleNudges(userId: string): Promise<void> {
  try {
    const enabled = await isNudgeEnabled();
    if (!enabled) return;

    // Prevent checking more than once per day
    const lastCheck = await AsyncStorage.getItem(LAST_NUDGE_KEY);
    const now = Date.now();
    if (lastCheck && now - parseInt(lastCheck) < 24 * 60 * 60 * 1000) return;
    await AsyncStorage.setItem(LAST_NUDGE_KEY, String(now));

    const { data } = await supabase
      .from('workout_logs')
      .select('completed_at')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    if (!data) return;

    const lastWorkoutDate = new Date(data.completed_at);
    const daysSince = Math.floor((now - lastWorkoutDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSince >= 3) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Time to get moving! 💪",
          body: `It's been ${daysSince} days since your last workout. A quick session goes a long way!`,
        },
        trigger: null, // immediate
      });
    }
  } catch {
    // silent
  }
}

/**
 * Compare this week's volume with last week's.
 * Returns an insight string or null.
 *
 * When the user has fewer than 2 full weeks of workout history,
 * percentage comparisons are misleading (e.g. "up 261%") so we
 * show absolute stats instead.
 */
export function checkVolumeInsight(
  thisWeekVolume: number,
  lastWeekVolume: number,
  options?: { thisWeekSessions?: number; hasEnoughHistory?: boolean },
): string | null {
  const { thisWeekSessions = 0, hasEnoughHistory = true } = options ?? {};

  // Not enough history for percentage comparisons - show absolute numbers
  if (!hasEnoughHistory) {
    if (thisWeekSessions > 0 && thisWeekVolume > 0) {
      const formatted = thisWeekVolume >= 1000
        ? `${(thisWeekVolume / 1000).toFixed(1)}k`
        : String(Math.round(thisWeekVolume));
      return `Logged ${thisWeekSessions} session${thisWeekSessions === 1 ? '' : 's'} this week · ${formatted} lbs total volume`;
    }
    if (thisWeekSessions > 0) {
      return `Logged ${thisWeekSessions} session${thisWeekSessions === 1 ? '' : 's'} this week. Keep it up!`;
    }
    return null;
  }

  // Need data in both weeks for a meaningful comparison
  if (lastWeekVolume === 0 || thisWeekVolume === 0) return null;

  const pct = Math.round(((thisWeekVolume - lastWeekVolume) / lastWeekVolume) * 100);
  if (pct > 10) return `Volume up ${pct}% vs last week. Great progress!`;
  if (pct < -10) return `Volume down ${Math.abs(pct)}% vs last week. Recovery week?`;
  return `Consistent volume this week. Staying on track!`;
}

/**
 * Check if the current set is a PR (personal record) for that exercise.
 */
export function checkPR(
  _exerciseName: string,
  currentWeight: number,
  historicalMaxWeight: number,
): boolean {
  return currentWeight > historicalMaxWeight && historicalMaxWeight > 0;
}
