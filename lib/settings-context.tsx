import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { Colors, ThemeColors } from '../constants/theme';

export type WeightUnit = 'lbs' | 'kg';
export type ThemeMode = 'light' | 'dark' | 'system';
export type RestTimerDuration = 60 | 75 | 90 | 105 | 120;

const STORAGE_KEYS = {
  theme: '@forme/theme',
  unit: '@forme/unit',
  restTimer: '@forme/restTimer',
  restTimerEnabled: '@forme/restTimerEnabled',
  restTimerSound: '@forme/restTimerSound',
  warmupEnabled: '@forme/warmupEnabled',
  trackCalories: '@forme/trackCalories',
};

interface Settings {
  weightUnit: WeightUnit;
  warmupEnabled: boolean;
  restTimerEnabled: boolean;
  restTimerSound: boolean;
  restTimerDuration: RestTimerDuration;
  trackCalories: boolean;
  themeMode: ThemeMode;
  theme: ThemeColors;
}

interface SettingsContextType extends Settings {
  setWeightUnit: (unit: WeightUnit) => void;
  setWarmupEnabled: (enabled: boolean) => void;
  setRestTimerEnabled: (enabled: boolean) => void;
  setRestTimerSound: (enabled: boolean) => void;
  setRestTimerDuration: (secs: RestTimerDuration) => void;
  setTrackCalories: (enabled: boolean) => void;
  setThemeMode: (mode: ThemeMode) => void;
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [weightUnit, setWeightUnitState] = useState<WeightUnit>('lbs');
  const [warmupEnabled, setWarmupEnabledState] = useState(true);
  const [restTimerEnabled, setRestTimerEnabledState] = useState(true);
  const [restTimerSound, setRestTimerSoundState] = useState(true);
  const [restTimerDuration, setRestTimerDurationState] = useState<RestTimerDuration>(60);
  const [trackCalories, setTrackCaloriesState] = useState(true);
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const systemColorScheme = useColorScheme();
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      // AsyncStorage first (fast, works offline)
      const [storedTheme, storedUnit, storedTimer, storedTimerEnabled, storedTimerSound, storedWarmup, storedTrackCal] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.theme),
        AsyncStorage.getItem(STORAGE_KEYS.unit),
        AsyncStorage.getItem(STORAGE_KEYS.restTimer),
        AsyncStorage.getItem(STORAGE_KEYS.restTimerEnabled),
        AsyncStorage.getItem(STORAGE_KEYS.restTimerSound),
        AsyncStorage.getItem(STORAGE_KEYS.warmupEnabled),
        AsyncStorage.getItem(STORAGE_KEYS.trackCalories),
      ]);

      if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') setThemeModeState(storedTheme);
      if (storedUnit === 'lbs' || storedUnit === 'kg') setWeightUnitState(storedUnit);
      if (storedTimer) {
        const d = parseInt(storedTimer) as RestTimerDuration;
        if ([30, 45, 60, 90, 120].includes(d)) setRestTimerDurationState(d);
      }
      if (storedTimerEnabled !== null) setRestTimerEnabledState(storedTimerEnabled !== 'false');
      if (storedTimerSound !== null) setRestTimerSoundState(storedTimerSound !== 'false');
      if (storedWarmup !== null) setWarmupEnabledState(storedWarmup !== 'false');
      if (storedTrackCal !== null) setTrackCaloriesState(storedTrackCal !== 'false');

      // Then sync from Supabase profile (may override)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('weight_unit, rest_timer_enabled, theme_mode')
          .eq('id', user.id)
          .single();
        if (data) {
          if (data.weight_unit) setWeightUnitState(data.weight_unit);
          if (data.rest_timer_enabled !== null) setRestTimerEnabledState(data.rest_timer_enabled);
          if (data.theme_mode === 'light' || data.theme_mode === 'dark' || data.theme_mode === 'system') setThemeModeState(data.theme_mode);
        }
      }
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  };

  const saveToProfile = async (updates: Record<string, unknown>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('profiles').upsert({ id: user.id, ...updates });
    } catch {}
  };

  const setWeightUnit = (unit: WeightUnit) => {
    setWeightUnitState(unit);
    AsyncStorage.setItem(STORAGE_KEYS.unit, unit);
    saveToProfile({ weight_unit: unit });
  };

  const setWarmupEnabled = (enabled: boolean) => {
    setWarmupEnabledState(enabled);
    AsyncStorage.setItem(STORAGE_KEYS.warmupEnabled, String(enabled));
  };

  const setRestTimerEnabled = (enabled: boolean) => {
    setRestTimerEnabledState(enabled);
    AsyncStorage.setItem(STORAGE_KEYS.restTimerEnabled, String(enabled));
    saveToProfile({ rest_timer_enabled: enabled });
  };

  const setRestTimerSound = (enabled: boolean) => {
    setRestTimerSoundState(enabled);
    AsyncStorage.setItem(STORAGE_KEYS.restTimerSound, String(enabled));
  };

  const setRestTimerDuration = (secs: RestTimerDuration) => {
    setRestTimerDurationState(secs);
    AsyncStorage.setItem(STORAGE_KEYS.restTimer, String(secs));
  };

  const setTrackCalories = (enabled: boolean) => {
    setTrackCaloriesState(enabled);
    AsyncStorage.setItem(STORAGE_KEYS.trackCalories, String(enabled));
  };

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(STORAGE_KEYS.theme, mode);
    saveToProfile({ theme_mode: mode });
  };

  const resolvedMode = themeMode === 'system' ? (systemColorScheme ?? 'dark') : themeMode;
  const theme = Colors[resolvedMode];

  return (
    <SettingsContext.Provider
      value={{
        weightUnit, warmupEnabled, restTimerEnabled, restTimerSound, restTimerDuration, trackCalories, themeMode, theme, loading,
        setWeightUnit, setWarmupEnabled, setRestTimerEnabled, setRestTimerSound, setRestTimerDuration, setTrackCalories, setThemeMode,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

export function convertWeight(kg: number, unit: WeightUnit): number {
  return unit === 'lbs' ? Math.round(kg * 2.205) : kg;
}

export function displayWeight(kg: number | null, unit: WeightUnit): string {
  if (kg == null) return '-';
  const val = convertWeight(kg, unit);
  return `${val} ${unit}`;
}
