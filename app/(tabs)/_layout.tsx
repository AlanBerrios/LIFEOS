import { Tabs } from 'expo-router';
import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { lifeTheme } from '../../src/theme';

const TABS = [
  { name: 'index',    label: 'Hoy',     icon: '⚡' },
  { name: 'calendar', label: 'Cal.',    icon: '📅' },
  { name: 'habits',   label: 'Hábitos', icon: '🌟' },
  { name: 'pool',     label: 'Tareas',  icon: '📋' },
  { name: 'routines', label: 'Rutinas', icon: '⏰' },
  { name: 'settings', label: 'Config',  icon: '⚙️' }
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
        tabBarShowLabel: false,
        tabBarIcon: ({ focused }) => {
          const tab = TABS.find((t) => t.name === route.name);
          if (!tab) return null;
          return (
            <View style={[styles.tabItem, { paddingBottom: Math.max(insets.bottom / 2, 4) }]}>
              {focused && <View style={styles.activePill} />}
              <Text style={[styles.tabIcon, focused && { transform: [{ scale: 1.1 }] }]}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
                {tab.label}
              </Text>
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
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    position: 'relative',
    paddingTop: 12,
    width: 64
  },
  activePill: {
    position: 'absolute',
    top: -1,
    width: 32,
    height: 3,
    borderRadius: 3,
    backgroundColor: lifeTheme.colors.primary
  },
  tabIcon: { fontSize: 21 },
  tabLabel: {
    color: lifeTheme.colors.muted,
    fontSize: 10,
    fontWeight: '600'
  },
  tabLabelActive: {
    color: lifeTheme.colors.primary,
    fontWeight: '800'
  }
});
