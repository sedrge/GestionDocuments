import { router, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { TenantProvider, useTenant } from '../context/TenantContext';
import { ThemeProvider } from '../context/ThemeContext';
import { registerForPushNotifications, setupNotificationListeners } from '@/lib/firebase';
import { supabase } from '../lib/supabase';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Garde de routage basé sur l'état du tenant
function RouteGuard() {
  const { loading, isAuthenticated, tenant, pendingState } = useTenant();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const root = segments[0] as string | undefined;

    // Attendre qu'Expo Router ait résolu la route (évite la race condition)
    if (!root) return;

    // Routes publiques — accessibles sans connexion (feed, chat client, contact)
    if (root === '(tabs)' || root === 'chat' || root === 'contact') return;

    const inAuthFlow = root === 'onboarding' || root === 'auth';
    const inPendingScreen = root === 'pending';
    const inAdminFlow = root === 'admin';

    if (!isAuthenticated) {
      if (!inAuthFlow) router.replace('/onboarding');
      return;
    }

    if (pendingState) {
      if (!inPendingScreen) router.replace('/pending');
      return;
    }

    if (tenant?.user_role === 'super_admin') {
      if (!inAdminFlow) router.replace('/admin/enterprises');
      return;
    }

    // Admin actif ou user actif : sortir du flow auth vers l'app
    if (tenant && inAuthFlow) {
      router.replace('/home');
    }
  }, [loading, isAuthenticated, tenant, pendingState, segments]);

  return null;
}

function AppStack() {
  return (
    <>
      <RouteGuard />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding/index" />
        <Stack.Screen name="onboarding/create-enterprise" />
        <Stack.Screen name="onboarding/join-enterprise" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="pending" />
        <Stack.Screen name="home" />
        <Stack.Screen name="admin/enterprises" />
        <Stack.Screen name="admin/users" />
        <Stack.Screen name="admin/contact" />
        <Stack.Screen name="admin/dashboard" />
        <Stack.Screen name="admin/stock" />
        <Stack.Screen name="admin/ventes" />
        <Stack.Screen name="admin/rapports" />
        <Stack.Screen name="contact" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="modal" options={{ presentation: 'modal', headerShown: true }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    const initPush = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const token = await registerForPushNotifications(user.id);
        if (token) console.log('✅ Token push enregistré:', token);
        setupNotificationListeners();
      }
    };
    initPush();
  }, []);

  return (
    <ThemeProvider>
      <TenantProvider>
        <AppStack />
      </TenantProvider>
    </ThemeProvider>
  );
}
