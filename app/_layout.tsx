import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { TenantProvider, useTenant } from '../context/TenantContext';
import { ThemeProvider } from '../context/ThemeContext';
import { FeatureFlagsProvider } from '../context/FeatureFlagsContext';
import { registerForPushNotifications, setupNotificationListeners } from '@/lib/firebase';
import { supabase } from '../lib/supabase';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RouteGuard() {
  const { loading, isAuthenticated, tenant, pendingState, isSuperAdmin, isImpersonating } = useTenant();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const root = segments[0] as string | undefined;
    if (!root) return;

    // Routes publiques
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

    // Super admin : redirige vers le hub super-admin (sauf si impersonation active)
    if (isSuperAdmin) {
      if (!inAdminFlow) router.replace('/admin/super-admin-home');
      return;
    }

    // Admin actif → dashboard ; user actif → home
    if (tenant && inAuthFlow) {
      if (tenant.user_role === 'enterprise_admin') {
        router.replace('/admin/dashboard');
      } else {
        router.replace('/home');
      }
    }
  }, [loading, isAuthenticated, tenant, pendingState, isSuperAdmin, isImpersonating, segments]);

  return null;
}

function ImpersonationBanner() {
  const { isImpersonating, tenant, stopImpersonation } = useTenant();
  if (!isImpersonating) return null;

  return (
    <View style={bannerStyles.banner}>
      <Ionicons name="eye-outline" size={15} color="#fff" />
      <Text style={bannerStyles.bannerText} numberOfLines={1}>
        Dépannage: <Text style={{ fontWeight: '700' }}>{tenant?.enterprise_name}</Text>
      </Text>
      <TouchableOpacity
        style={bannerStyles.exitBtn}
        onPress={() => {
          stopImpersonation();
          router.replace('/admin/super-admin-home');
        }}
        activeOpacity={0.8}
      >
        <Text style={bannerStyles.exitText}>Quitter</Text>
      </TouchableOpacity>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  banner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 99,
    backgroundColor: '#5856D6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 8,
  },
  bannerText: { color: '#fff', flex: 1, fontSize: 13 },
  exitBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  exitText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});

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
        <Stack.Screen name="auth/super-admin-register" />
        <Stack.Screen name="pending" />
        <Stack.Screen name="home" />
        <Stack.Screen name="admin/super-admin-home" />
        <Stack.Screen name="admin/super-admin-config" />
        <Stack.Screen name="admin/enterprises" />
        <Stack.Screen name="admin/users" />
        <Stack.Screen name="admin/contact" />
        <Stack.Screen name="admin/dashboard" />
        <Stack.Screen name="admin/stock" />
        <Stack.Screen name="admin/ventes" />
        <Stack.Screen name="admin/rapports" />
        <Stack.Screen name="admin/audit" />
        <Stack.Screen name="admin/user_permissions" />
        <Stack.Screen name="admin/enterprise_features" />
        <Stack.Screen name="admin/publications" />
        <Stack.Screen name="admin/facebook" />
        <Stack.Screen name="admin/tiktok" />
        <Stack.Screen name="admin/chat" />
        <Stack.Screen name="admin/assistant" />
        <Stack.Screen name="contact" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="modal" options={{ presentation: 'modal', headerShown: true }} />
      </Stack>
      <ImpersonationBanner />
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
    <SafeAreaProvider>
      <ThemeProvider>
        <TenantProvider>
          <FeatureFlagsProvider>
            <AppStack />
          </FeatureFlagsProvider>
        </TenantProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
