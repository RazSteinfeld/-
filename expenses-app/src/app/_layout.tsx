import {
  Heebo_400Regular,
  Heebo_500Medium,
  Heebo_600SemiBold,
  Heebo_700Bold,
  Heebo_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/heebo';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React, { useEffect } from 'react';
import { I18nManager, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StoreProvider, useStore } from '../store';
import { Button, ErrorState, Skeleton } from '../ui/components';
import { usePalette } from '../ui/theme';

// האפליקציה בעברית: מאפשרים RTL מקורי. אם המכשיר באנגלית, הממשק מתהפך ידנית (ראה ui/rtl.ts).
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 350, fade: true });

function Gate() {
  const p = usePalette();
  const { ready, loadError, retryLoad, resetAfterLoadError } = useStore();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(p.bg).catch(() => {});
  }, [p.bg]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, padding: 24, paddingTop: 80, gap: 16 }}>
        <Skeleton height={36} width="50%" />
        <Skeleton height={190} radiusPx={28} />
        <Skeleton height={220} radiusPx={22} />
      </View>
    );
  }
  if (loadError) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, justifyContent: 'center' }}>
        <ErrorState
          title="לא הצלחתי לטעון את הנתונים"
          body={`${loadError} הנתונים עצמם לא נמחקו. אפשר לנסות שוב, או להתחיל מאפס ולשחזר מגיבוי.`}
          onAction={retryLoad}
        />
        <View style={{ alignItems: 'center' }}>
          <Button label="התחל מאפס (מוחק את מה ששמור)" onPress={resetAfterLoadError} variant="danger" compact />
        </View>
      </View>
    );
  }
  return (
    <>
      <StatusBar style={p.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg }, animation: 'fade' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="import" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Heebo_400Regular, Heebo_500Medium, Heebo_600SemiBold, Heebo_700Bold, Heebo_800ExtraBold,
  });
  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);
  if (!fontsLoaded && !fontError) return null;
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Gate />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const p = usePalette();
  return (
    <View style={{ flex: 1, backgroundColor: p.bg, justifyContent: 'center' }}>
      <ErrorState
        title="אופס, משהו השתבש"
        body={`המסך הזה נתקל בשגיאה. הנתונים שלך שמורים ובטוחים. ${error?.message ? `(${error.message})` : ''}`}
        onAction={() => { retry(); }}
      />
    </View>
  );
}
