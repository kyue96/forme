import { Pressable, Text, View } from 'react-native';
import { useSettings } from '@/lib/settings-context';
import { useUserStore } from '@/lib/user-store';
import { AvatarInitial } from '@/components/AvatarInitial';

export function AppHeader() {
  const { theme } = useSettings();
  const { displayName, avatarUrl, avatarColor, openDrawer } = useUserStore();

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 10,
      backgroundColor: theme.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    }}>
      <Pressable onPress={openDrawer} hitSlop={8}>
        <AvatarInitial name={displayName} avatarUrl={avatarUrl} avatarColor={avatarColor} size={32} />
      </Pressable>
      <Text style={{
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: 3,
        color: theme.text,
        textTransform: 'uppercase',
        marginLeft: 12,
      }}>
        FORME
      </Text>
    </View>
  );
}
