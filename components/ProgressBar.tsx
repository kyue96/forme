import { View } from 'react-native';
import { useSettings } from '@/lib/settings-context';

interface ProgressBarProps {
  step: number;
  total: number;
}

export function ProgressBar({ step, total }: ProgressBarProps) {
  const { theme } = useSettings();
  const progress = (step / total) * 100;
  return (
    <View style={{ width: '100%', height: 3, backgroundColor: theme.border, borderRadius: 2, overflow: 'hidden' }}>
      <View style={{ height: '100%', backgroundColor: theme.text, borderRadius: 2, width: `${progress}%` }} />
    </View>
  );
}
