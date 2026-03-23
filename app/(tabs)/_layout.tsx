import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '@/lib/settings-context';
import { useUserStore } from '@/lib/user-store';
import { ProfileDrawer } from '@/components/ProfileDrawer';

type IoniconName = keyof typeof Ionicons.glyphMap;

function TabIcon({ icon, focused, activeColor, inactiveColor }: { icon: IoniconName; focused: boolean; activeColor: string; inactiveColor: string }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 6 }}>
      <Ionicons
        name={focused ? icon : (`${icon}-outline` as IoniconName)}
        size={24}
        color={focused ? activeColor : inactiveColor}
      />
    </View>
  );
}

export default function TabsLayout() {
  const { theme } = useSettings();
  const loadUser = useUserStore((s) => s.loadUser);

  useEffect(() => {
    loadUser();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          lazy: false,
          freezeOnBlur: false,
          sceneStyle: { backgroundColor: theme.background },
          tabBarStyle: {
            height: 60,
            paddingTop: 0,
            paddingBottom: 8,
            backgroundColor: theme.background,
            borderTopWidth: 1,
            borderTopColor: theme.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.04,
            shadowRadius: 12,
            elevation: 12,
          },
          animation: 'fade',
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarIcon: ({ focused }) => <TabIcon icon="home" focused={focused} activeColor={theme.text} inactiveColor={theme.chrome} />,
          }}
        />
        <Tabs.Screen
          name="workout"
          options={{
            tabBarIcon: ({ focused }) => <TabIcon icon="barbell" focused={focused} activeColor={theme.text} inactiveColor={theme.chrome} />,
          }}
        />
        <Tabs.Screen
          name="stats"
          options={{
            tabBarIcon: ({ focused }) => <TabIcon icon="stats-chart" focused={focused} activeColor={theme.text} inactiveColor={theme.chrome} />,
          }}
        />
        <Tabs.Screen
          name="meals"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="social"
          options={{
            tabBarIcon: ({ focused }) => <TabIcon icon="people" focused={focused} activeColor={theme.text} inactiveColor={theme.chrome} />,
          }}
        />
      </Tabs>
      <ProfileDrawer />
    </View>
  );
}
