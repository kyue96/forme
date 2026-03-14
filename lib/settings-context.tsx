import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { Colors, ThemeColors } from '../constants/theme';

export type WeightUnit = 'lbs' | 'kg';
export type ThemeMode = 'light' | 'dark';
export type RestTimerDuration = 30 | 60 | 90 | 120;

const STORAGE_KEYS = {
  theme: '@forme/theme',
  unit: '@forme/unit',
  restTimer: '@forme/restTimer',
  restTimerEnabled: '@forme/restTimerEnabled',
};

interface Settings {
  weightUnit: WeightUnit;
  restTimerEnabled: boolean;
  restTimerDuration: RestTimerDuration;
  themeMode: ThemeMode;
  theme: ThemeColors;
}

interface SettingsContextType extends Settings {
  setWeightUnit: (unit: WeightUnit) => void;
  setRestTimerEnabled: (enabled: boolean) => void;
  setRestTimerDuration: (secs: RestTimerDuration) => void;
  setThemeMode: (mode: ThemeMode) => void;
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [weightUnit, setWeightUnitState] = useState<WeightUnit>('lbs');
  const [restTimerEnabled, setRestTimerEnabledState] = useState(true);
  const [restTimerDuration, setRestTimerDurationState] = useState<RestTimerDuration>(60);
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      // AsyncStorage first (fast, works offline)
      const [storedTheme, storedUnit, storedTimer, storedTimerEnabled] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.theme),
        AsyncStorage.getItem(STORAGE_KEYS.unit),
        AsyncStorage.getItem(STORAGE_KEYS.restTimer),
        AsyncStorage.getItem(STORAGE_KEYS.restTimerEnabled),
      ]);

      if (storedTheme === 'light' || storedTheme === 'dark') setThemeModeState(storedTheme);
      if (storedUnit === 'lbs' || storedUnit === 'kg') setWeightUnitState(storedUnit);
      if (storedTimer) {
        const d = parseInt(storedTimer) as RestTimerDuration;
        if ([30, 60, 90, 120].includes(d)) setRestTimerDurationState(d);
      }
      if (storedTimerEnabled !== null) setRestTimerEnabledState(storedTimerEnabled !== 'false');

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
          if (data.theme_mode) setThemeModeState(data.theme_mode);
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

  const setRestTimerEnabled = (enabled: boolean) => {
    setRestTimerEnabledState(enabled);
    AsyncStorage.setItem(STORAGE_KEYS.restTimerEnabled, String(enabled));
    saveToProfile({ rest_timer_enabled: enabled });
  };

  const setRestTimerDuration = (secs: RestTimerDuration) => {
    setRestTimerDurationState(secs);
    AsyncStorage.setItem(STORAGE_KEYS.restTimer, String(secs));
  };

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(STORAGE_KEYS.theme, mode);
    saveToProfile({ theme_mode: mode });
  };

  const theme = Colors[themeMode];

  return (
    <SettingsContext.Provider
      value={{
        weightUnit, restTimerEnabled, restTimerDuration, themeMode, theme, loading,
        setWeightUnit, setRestTimerEnabled, setRestTimerDuration, setThemeMode,
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
  if (kg == null) return '—';
  const val = convertWeight(kg, unit);
  return `${val} ${unit}`;
}
