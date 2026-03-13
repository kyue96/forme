import { View } from 'react-native';

interface ProgressBarProps {
  step: number;
  total: number;
}

export function ProgressBar({ step, total }: ProgressBarProps) {
  const progress = (step / total) * 100;

  return (
    <View className="w-full h-1 bg-zinc-100 rounded-full overflow-hidden">
      <View
        className="h-full bg-zinc-900 rounded-full"
        style={{ width: `${progress}%` }}
      />
    </View>
  );
}
