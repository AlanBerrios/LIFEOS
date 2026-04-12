import { MaterialTabs } from '../../src/components/MaterialTabs';
import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../src/theme';

import { Zap, Calendar, CheckCircle, ListTodo, Clock, Settings, Book, BarChart } from 'lucide-react-native';

const TABS = [
  { name: 'index',    label: 'Hoy',        IconComponent: Zap },
  { name: 'calendar', label: 'Calendario', IconComponent: Calendar },
  { name: 'pool',     label: 'Tareas',     IconComponent: ListTodo },
  { name: 'habits',   label: 'Hábitos',    IconComponent: CheckCircle },
  { name: 'routines', label: 'Rutinas',    IconComponent: Clock },
  { name: 'notes',    label: 'Notas',      IconComponent: Book },
  { name: 'stats',    label: 'Métricas',   IconComponent: BarChart },
  { name: 'settings', label: 'Ajustes',    IconComponent: Settings }
];

export default function TabLayout(): ReactElement {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const barHeight = 64 + Math.max(insets.bottom, 12);
  const styles = createStyles(theme);

  return (
    <MaterialTabs
      tabBarPosition="bottom"
      keyboardDismissMode="on-drag"
      screenOptions={({ route }: { route: { name: string } }) => ({
        tabBarIndicatorStyle: { height: 0 }, // Hide the default top indicator
        tabBarStyle: [styles.tabBar, { height: barHeight }],
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '700',
          textTransform: 'none',
          marginBottom: Math.max(insets.bottom / 2, 4)
        },
        tabBarItemStyle: { padding: 0 },
        tabBarIcon: ({ focused }: { focused: boolean }) => {
          const tab = TABS.find((t) => t.name === route.name);
          if (!tab) return <View style={styles.iconContainer} />;
          return (
            <View style={styles.iconContainer}>
              {focused && <View style={styles.activePill} />}
              <View style={focused && { transform: [{ scale: 1.1 }] }}>
                <tab.IconComponent size={22} color={focused ? theme.colors.primary : theme.colors.muted} strokeWidth={focused ? 2.5 : 2} />
              </View>
            </View>
          );
        }
      })}
    >
      {TABS.map((tab) => (
        <MaterialTabs.Screen 
          key={tab.name} 
          name={tab.name} 
          options={{
            tabBarLabel: tab.label
          }}
        />
      ))}
    </MaterialTabs>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    tabBar: {
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
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
      backgroundColor: theme.colors.primary
    }
  });
}
