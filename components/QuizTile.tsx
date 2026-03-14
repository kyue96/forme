import { Pressable, Text } from 'react-native';
import { useSettings } from '@/lib/settings-context';

interface QuizTileProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function QuizTile({ label, selected, onPress }: QuizTileProps) {
  const { theme } = useSettings();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        minWidth: '45%',
        marginHorizontal: 4,
        marginBottom: 12,
        paddingVertical: 20,
        paddingHorizontal: 16,
        borderRadius: 16,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: selected ? theme.text : theme.surface,
        borderColor: selected ? theme.text : theme.border,
      }}
    >
      <Text style={{ fontSize: 15, fontWeight: '600', color: selected ? theme.background : theme.text }}>
        {label}
      </Text>
    </Pressable>
  );
}
