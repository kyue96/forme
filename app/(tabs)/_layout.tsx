import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = keyof typeof Ionicons.glyphMap;

function TabIcon({
  icon,
  label,
  focused,
}: {
  icon: IoniconName;
  label: string;
  focused: boolean;
}) {
  const color = focused ? '#18181B' : '#C4C4C4';
  return (
    <View style={{ alignItems: 'center', gap: 3, paddingTop: 4 }}>
      <Ionicons name={focused ? icon : (`${icon}-outline` as IoniconName)} size={22} color={color} />
      <Text
        style={{
          fontSize: 10,
          fontWeight: focused ? '600' : '400',
          color,
          letterSpacing: 0.3,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: 74,
          paddingTop: 0,
          paddingBottom: 10,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 16,
          elevation: 16,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="calendar" label="Today" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="barbell" label="My Plan" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="person" label="Profile" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
