import { Tabs } from 'expo-router';
import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { lifeTheme } from '../../src/theme';

import { Zap, Calendar, CheckCircle, ListTodo, Clock, Settings, Book, BarChart } from 'lucide-react-native';

const TABS = [
  { name: 'index',    label: 'Hoy',     IconComponent: Zap },
  { name: 'calendar', label: 'Cal.',    IconComponent: Calendar },
  { name: 'pool',     label: 'Tareas',  IconComponent: ListTodo },
  { name: 'habits',   label: 'Hábitos', IconComponent: CheckCircle },
  { name: 'routines', label: 'Rutinas', IconComponent: Clock },
  { name: 'notes',    label: 'Notas',   IconComponent: Book },
  { name: 'stats',    label: 'Stats',   IconComponent: BarChart },
  { name: 'settings', label: 'Config',  IconComponent: Settings }
];

export default function TabLayout(): ReactElement {
  const insets = useSafeAreaInsets();
  const barHeight = 64 + Math.max(insets.bottom, 12);

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: [styles.tabBar, { height: barHeight }],
        tabBarActiveTintColor: lifeTheme.colors.primary,
        tabBarInactiveTintColor: lifeTheme.colors.muted,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '700',
          marginBottom: Math.max(insets.bottom / 2, 4)
        },
        tabBarItemStyle: { padding: 0 },
        tabBarIcon: ({ focused }) => {
          const tab = TABS.find((t) => t.name === route.name);
          if (!tab) return null;
          return (
            <View style={styles.iconContainer}>
              {focused && <View style={styles.activePill} />}
              <View style={focused && { transform: [{ scale: 1.1 }] }}>
                <tab.IconComponent size={22} color={focused ? lifeTheme.colors.primary : lifeTheme.colors.muted} strokeWidth={focused ? 2.5 : 2} />
              </View>
            </View>
          );
        }
      })}
    >
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: lifeTheme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: lifeTheme.colors.border,
    paddingBottom: 0,
    paddingTop: 0,
    elevation: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    width: 48,
    overflow: 'visible'
  },
  activePill: {
    position: 'absolute',
    top: -4,
    width: 28,
    height: 3,
    borderRadius: 3,
    backgroundColor: lifeTheme.colors.primary
  }
});
