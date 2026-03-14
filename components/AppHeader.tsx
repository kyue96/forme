import { Text, View } from 'react-native';
import { useSettings } from '@/lib/settings-context';

export function AppHeader() {
  const { theme } = useSettings();

  return (
    <View style={{
      paddingHorizontal: 20,
      paddingVertical: 14,
      backgroundColor: theme.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    }}>
      <Text style={{
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: 3,
        color: theme.text,
        textTransform: 'uppercase',
      }}>
        FORME
      </Text>
    </View>
  );
}
