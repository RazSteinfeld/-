import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, type IconName } from './components';
import { ROW } from './rtl';
import { radius, shadowFor, usePalette } from './theme';
import { useAnimatedValue } from './anim';

type BottomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

const ICONS: Record<string, { on: IconName; off: IconName }> = {
  index: { on: 'chart-donut', off: 'chart-donut-variant' },
  transactions: { on: 'swap-vertical-bold', off: 'swap-vertical' },
  savings: { on: 'piggy-bank', off: 'piggy-bank-outline' },
  more: { on: 'dots-grid', off: 'dots-grid' },
};

function Item({ focused, label, name, onPress }: { focused: boolean; label: string; name: string; onPress: () => void }) {
  const p = usePalette();
  const v = useAnimatedValue(focused ? 1 : 0);
  useEffect(() => {
    Animated.spring(v, { toValue: focused ? 1 : 0, speed: 22, bounciness: 6, useNativeDriver: false }).start();
  }, [focused, v]);
  const icon = ICONS[name] ?? ICONS.more;
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: focused }} style={{ flex: 1 }}>
      <Animated.View
        style={{
          alignItems: 'center', justifyContent: 'center', gap: 2, height: 52, borderRadius: radius.lg, marginHorizontal: 3,
          backgroundColor: v.interpolate({ inputRange: [0, 1], outputRange: ['rgba(0,0,0,0)', p.primarySoft] }),
        }}
      >
        <Animated.View style={{ transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }] }}>
          <MaterialCommunityIcons name={focused ? icon.on : icon.off} size={24} color={focused ? p.primary : p.textMuted} />
        </Animated.View>
        <T variant="micro" align="center" color={focused ? p.primary : p.textMuted}>{label}</T>
      </Animated.View>
    </Pressable>
  );
}

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', start: 0, end: 0, bottom: 0, paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 10) + 4 }}>
      <View
        style={[
          {
            flexDirection: ROW, padding: 6, borderRadius: radius.xl, backgroundColor: p.tabBar,
            borderWidth: p.scheme === 'dark' ? 1 : 0, borderColor: p.border,
          },
          shadowFor(p, 3),
        ]}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const label = descriptors[route.key].options.title ?? route.name;
          return (
            <Item
              key={route.key}
              focused={focused}
              label={label}
              name={route.name}
              onPress={() => {
                const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !e.defaultPrevented) {
                  Haptics.selectionAsync().catch(() => {});
                  navigation.navigate(route.name, route.params);
                }
              }}
            />
          );
        })}
      </View>
    </View>
  );
}
