import type { ReactElement } from 'react';
import { Tabs, usePathname } from 'expo-router';
import { CalendarDays, CheckCircle2, Grid2X2, ListTodo, Zap } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../src/theme';

const PRIMARY_TABS = [
  { name: 'index', label: 'Hoy', Icon: Zap },
  { name: 'calendar', label: 'Calendario', Icon: CalendarDays },
  { name: 'pool', label: 'Tareas', Icon: ListTodo },
  { name: 'habits', label: 'Hábitos', Icon: CheckCircle2 },
  { name: 'more', label: 'Más', Icon: Grid2X2 }
] as const;

const HIDDEN_TABS = ['routines', 'notes', 'stats', 'settings'] as const;

export default function TabLayout(): ReactElement {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const moreOwnsCurrentRoute = HIDDEN_TABS.some((route) => pathname.includes(`/${route}`));

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        lazy: true,
        sceneStyle: { backgroundColor: theme.colors.background },
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
        tabBarStyle: [styles.bar, { height: 68 + Math.max(insets.bottom, 8) }]
      }}
    >
      {PRIMARY_TABS.map(({ name, label, Icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: label,
            tabBarAccessibilityLabel: label,
            tabBarLabel: ({ focused }) => {
              const active = focused || (name === 'more' && moreOwnsCurrentRoute);
              return <Text style={[styles.label, { color: active ? theme.colors.primary : theme.colors.muted }]}>{label}</Text>;
            },
            tabBarIcon: ({ focused, color }) => (
              <View style={[styles.iconWrap, (focused || (name === 'more' && moreOwnsCurrentRoute)) && styles.iconWrapActive]}>
                <Icon
                  size={21}
                  color={focused || (name === 'more' && moreOwnsCurrentRoute) ? theme.colors.primary : color}
                  strokeWidth={focused || (name === 'more' && moreOwnsCurrentRoute) ? 2.5 : 2}
                />
              </View>
            )
          }}
        />
      ))}
      {HIDDEN_TABS.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: null }} />
      ))}
    </Tabs>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    bar: {
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingTop: 5,
      paddingBottom: 0
    },
    item: { minHeight: 56, paddingVertical: 0 },
    label: { fontSize: 11, lineHeight: 14, fontWeight: '700' },
    iconWrap: {
      width: 44,
      height: 30,
      borderRadius: theme.radius.full,
      alignItems: 'center',
      justifyContent: 'center'
    },
    iconWrapActive: { backgroundColor: theme.colors.softPrimary }
  });
}
