import '../global.css';

import { useEffect, useState } from 'react';
import { Platform, Text, TextInput } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { QuizProvider } from '@/lib/quiz-store';
import { PlanProvider } from '@/lib/plan-context';
import { SettingsProvider, useSettings } from '@/lib/settings-context';

// Fix Android text clipping — override render to inject includeFontPadding: false
// This is a no-op on iOS. On Android it removes extra top/bottom padding that causes cutoff.
if (Platform.OS === 'android') {
  const origTextRender = (Text as any).render;
  if (origTextRender) {
    (Text as any).render = function (props: any, ref: any) {
      const style = [{ includeFontPadding: false }, props.style];
      return origTextRender.call(this, { ...props, style }, ref);
    };
  } else {
    // Fallback for versions without .render
    const OrigText = Text as any;
    if (!OrigText.defaultProps) OrigText.defaultProps = {};
    OrigText.defaultProps.includeFontPadding = false;
  }

  const origInputRender = (TextInput as any).render;
  if (origInputRender) {
    (TextInput as any).render = function (props: any, ref: any) {
      const style = [{ includeFontPadding: false }, props.style];
      return origInputRender.call(this, { ...props, style }, ref);
    };
  } else {
    const OrigInput = TextInput as any;
    if (!OrigInput.defaultProps) OrigInput.defaultProps = {};
    OrigInput.defaultProps.includeFontPadding = false;
  }
}

SplashScreen.preventAutoHideAsync();

function RootLayoutNav({ session }: { session: Session | null }) {
  const router = useRouter();
  const segments = useSegments();
  const { theme, themeMode } = useSettings();

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';
    const onOnboarding = segments[1] === 'onboarding';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (session && inAuthGroup && !onOnboarding) {
      router.replace('/(tabs)');
    }
  }, [session, segments]);

  // Detect dark theme by checking if background color is dark
  const isDark = (() => {
    const hex = theme.background.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  })();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="quiz" />
        <Stack.Screen name="plan-result" />
        <Stack.Screen name="workout/[dayIndex]" />
        <Stack.Screen name="create-post" options={{ presentation: 'modal' }} />
        <Stack.Screen name="barcode-scanner" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="user/[userId]" />
        <Stack.Screen name="discover" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoaded(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <SettingsProvider>
      <QuizProvider>
        <PlanProvider>
          <RootLayoutNav session={session} />
        </PlanProvider>
      </QuizProvider>
    </SettingsProvider>
  );
}
