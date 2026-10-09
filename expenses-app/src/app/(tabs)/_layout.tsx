import { Tabs } from 'expo-router';
import React from 'react';
import { TabBar } from '../../ui/TabBar';

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'סקירה' }} />
      <Tabs.Screen name="transactions" options={{ title: 'תנועות' }} />
      <Tabs.Screen name="savings" options={{ title: 'חיסכון' }} />
      <Tabs.Screen name="more" options={{ title: 'עוד' }} />
    </Tabs>
  );
}
