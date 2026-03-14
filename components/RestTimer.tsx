import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSettings } from '@/lib/settings-context';

interface RestTimerProps {
  seconds: number;
  onDismiss: () => void;
}

export function RestTimer({ seconds, onDismiss }: RestTimerProps) {
  const { theme } = useSettings();
  const [remaining, setRemaining] = useState(seconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const label = mins > 0
    ? `${mins}:${String(secs).padStart(2, '0')}`
    : `${secs}s`;

  const progress = 1 - remaining / seconds;

  return (
    <View style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 28,
      alignItems: 'center',
      borderTopWidth: 1,
      borderColor: theme.border,
    }}>
      {/* Progress bar */}
      <View style={{ width: '100%', height: 3, backgroundColor: theme.border, borderRadius: 2, marginBottom: 20, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${progress * 100}%`, backgroundColor: theme.chrome, borderRadius: 2 }} />
      </View>

      <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '600', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>
        Rest timer
      </Text>
      <Text style={{ color: theme.text, fontSize: 64, fontWeight: '800', letterSpacing: -2, marginBottom: 20, fontVariant: ['tabular-nums'] }}>
        {label}
      </Text>
      <Pressable
        onPress={onDismiss}
        style={{
          backgroundColor: theme.chromeLight,
          paddingHorizontal: 32,
          paddingVertical: 12,
          borderRadius: 24,
        }}
      >
        <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>Skip</Text>
      </Pressable>
    </View>
  );
}
