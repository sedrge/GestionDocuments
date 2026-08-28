import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { TenantProvider, useTenant } from '../context/TenantContext';
import { ThemeProvider } from '../context/ThemeContext';
import { FeatureFlagsProvider } from '../context/FeatureFlagsContext';
import { registerForPushNotifications, setupNotificationListeners } from '@/lib/firebase';
import { useAppUpdates } from '@/hooks/use-app-updates';
import { getToken } from '../lib/api';

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
    if (root === '(tabs)' || root === 'chat' || root === 'contact' || root === 'dev-api-test') return;

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

    // /home est le hub de navigation (menu latéral donnant accès au
    // dashboard admin, stock, ventes, etc.) — /admin/dashboard n'a pas ce
    // menu et serait une impasse en arrivée directe, donc tout le monde
    // atterrit sur /home après connexion (cohérent avec la logique de
    // (tabs)/index.tsx qui fait de même après un redémarrage de l'app).
    if (tenant && inAuthFlow) {
      router.replace('/home');
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

/**
 * Bannière non bloquante : uniquement pour la mise à jour OTA du JS (EAS
 * Update), déjà téléchargée en tâche de fond, l'utilisateur choisit quand
 * redémarrer. La mise à jour native (Play Store) n'a pas besoin de sa
 * propre bannière : en mode flexible, c'est Play Core lui-même qui invite
 * au redémarrage une fois prêt (voir hooks/use-app-updates.ts).
 */
function UpdateBanner() {
  const { jsUpdateReady, applyJsUpdate } = useAppUpdates();
  const insets = useSafeAreaInsets();
  if (!jsUpdateReady) return null;

  return (
    <View style={[bannerStyles.updateBanner, { top: insets.top + 8 }]}>
      <Ionicons name="arrow-up-circle-outline" size={16} color="#fff" />
      <Text style={bannerStyles.bannerText} numberOfLines={1}>
        Nouvelle version disponible
      </Text>
      <TouchableOpacity style={bannerStyles.exitBtn} onPress={applyJsUpdate} activeOpacity={0.8}>
        <Text style={bannerStyles.exitText}>Redémarrer</Text>
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
  updateBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 99,
    backgroundColor: '#2E7D32',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
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
        <Stack.Screen name="admin/enterprise_subscription" />
        <Stack.Screen name="admin/subscription_config" />
        <Stack.Screen name="admin/help_config" />
        <Stack.Screen name="admin/sebpay_payout" />
        <Stack.Screen name="admin/my-stores" />
        <Stack.Screen name="admin/create-store" />
        <Stack.Screen name="admin/enterprise-stores" />
        <Stack.Screen name="abonnement" />
        <Stack.Screen name="admin/publications" />
        <Stack.Screen name="admin/facebook" />
        <Stack.Screen name="admin/tiktok" />
        <Stack.Screen name="admin/chat" />
        <Stack.Screen name="admin/assistant" />
        <Stack.Screen name="contact" />
        <Stack.Screen name="aide" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="dev-api-test" />
        <Stack.Screen name="modal" options={{ presentation: 'modal', headerShown: true }} />
      </Stack>
      <ImpersonationBanner />
      <UpdateBanner />
      <StatusBar style="auto" />
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    const initPush = async () => {
      const authToken = await getToken();
      if (authToken) {
        const token = await registerForPushNotifications();
        if (token) console.log('✅ Token push enregistré:', token);
        setupNotificationListeners();
      }
    };
    initPush();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <TenantProvider>
            <FeatureFlagsProvider>
              <AppStack />
            </FeatureFlagsProvider>
          </TenantProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
