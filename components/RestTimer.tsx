import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

interface RestTimerProps {
  seconds: number;
  onDismiss: () => void;
}

export function RestTimer({ seconds, onDismiss }: RestTimerProps) {
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

  return (
    <View className="absolute bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl p-6 items-center">
      <Text className="text-zinc-400 text-sm font-medium mb-2">Rest timer</Text>
      <Text className="text-white text-6xl font-bold tracking-tight mb-6">{label}</Text>
      <Pressable
        onPress={onDismiss}
        className="bg-white/10 px-8 py-3 rounded-full"
      >
        <Text className="text-white font-semibold">Skip</Text>
      </Pressable>
    </View>
  );
}
