import { withLayoutContext } from 'expo-router';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import type { ReactElement } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { lifeTheme } from '../../src/theme';

const { Navigator } = createMaterialTopTabNavigator();
const MaterialTabs = withLayoutContext(Navigator);

const TABS = [
  { name: 'index', label: 'Hoy', icon: '⚡' },
  { name: 'calendar', label: 'Calendario', icon: '📅' },
  { name: 'pool', label: 'Tareas', icon: '📋' },
  { name: 'stats', label: 'Stats', icon: '📊' },
  { name: 'settings', label: 'Config', icon: '⚙️' }
];

export default function TabLayout(): ReactElement {
  const insets = useSafeAreaInsets();

  return (
    <MaterialTabs
      tabBarPosition="bottom"
      screenOptions={{
        swipeEnabled: true,
        animationEnabled: true,
        tabBarStyle: { display: 'none' }, // Ocultamos la barra nativa para usar la custom
        lazy: false
      }}
      tabBar={(props) => {
        const { state, navigation } = props;
        return (
          <View style={[styles.bottomBar, { paddingBottom: insets.bottom }]}>
            {TABS.map((tab, index) => {
              const focused = state.index === index;
              return (
                <Pressable
                  key={tab.name}
                  style={styles.tabItem}
                  onPress={() => navigation.navigate(tab.name)}
                >
                  <Text style={focused ? styles.iconActive : styles.icon}>
                    {tab.icon}
                  </Text>
                  <Text style={[styles.label, focused && styles.labelActive]}>
                    {tab.label}
                  </Text>
                  {focused && <View style={styles.activeIndicator} />}
                </Pressable>
              );
            })}
          </View>
        );
      }}
    >
      <MaterialTabs.Screen name="index" />
      <MaterialTabs.Screen name="calendar" />
      <MaterialTabs.Screen name="pool" />
      <MaterialTabs.Screen name="stats" />
      <MaterialTabs.Screen name="settings" />
    </MaterialTabs>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: lifeTheme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: lifeTheme.colors.border,
    paddingTop: 10
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingBottom: 6,
    position: 'relative'
  },
  icon: {
    fontSize: 22
  },
  iconActive: {
    fontSize: 22
  },
  label: {
    fontSize: 10,
    color: lifeTheme.colors.muted,
    fontWeight: '500'
  },
  labelActive: {
    color: lifeTheme.colors.primary,
    fontWeight: '700'
  },
  activeIndicator: {
    position: 'absolute',
    top: -10,
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: lifeTheme.colors.primary
  }
});
