import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTenant } from '../context/TenantContext';
import {
  checkAndIncrementFeatureUsage,
  QUOTA_EXCEEDED_MESSAGE,
} from '../lib/enterpriseFeatures';

interface QuotaGateProps {
  featureKey: string;
  featureName?: string;
  children: React.ReactNode;
}

/**
 * Composant de protection par quota : à l'ouverture, consomme une utilisation
 * du jour pour `featureKey` et affiche le contenu enfant si le quota n'est pas
 * atteint, sinon affiche un écran "quota atteint".
 *
 * Contrairement à FeatureGate (activé/désactivé), QuotaGate compte les
 * utilisations quotidiennes — à utiliser sur les écrans/actions à usage limité
 * par jour (ex: Assistant IA).
 *
 * Usage :
 *   <QuotaGate featureKey="assistant_ia.actif" featureName="Assistant IA">
 *     <AssistantContent />
 *   </QuotaGate>
 */
export const QuotaGate = ({ featureKey, featureName, children }: QuotaGateProps) => {
  const { tenant, isSuperAdmin } = useTenant();
  const [status, setStatus] = useState<'checking' | 'allowed' | 'blocked'>('checking');

  useEffect(() => {
    let active = true;

    (async () => {
      if (isSuperAdmin || !tenant?.enterprise_id) {
        if (active) setStatus('allowed');
        return;
      }
      const result = await checkAndIncrementFeatureUsage(tenant.enterprise_id, featureKey);
      if (active) setStatus(result.allowed ? 'allowed' : 'blocked');
    })();

    return () => {
      active = false;
    };
  }, [tenant?.enterprise_id, featureKey, isSuperAdmin]);

  if (status === 'checking') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#8E8E93" />
      </View>
    );
  }

  if (status === 'blocked') {
    return (
      <View style={styles.container}>
        <View style={styles.iconWrapper}>
          <Ionicons name="time-outline" size={52} color="#FF9500" />
        </View>
        <Text style={styles.title}>Quota quotidien atteint</Text>
        <Text style={styles.subtitle}>
          {featureName
            ? `La limite quotidienne d'utilisation de "${featureName}" est atteinte.`
            : "La limite quotidienne d'utilisation de cette fonctionnalité est atteinte."}
        </Text>
        <View style={styles.contactBox}>
          <Ionicons name="information-circle-outline" size={16} color="#FF9500" />
          <Text style={styles.contactText}>{QUOTA_EXCEEDED_MESSAGE}</Text>
        </View>
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 36,
    paddingBottom: 40,
  },
  iconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  contactBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 28,
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  contactText: {
    fontSize: 13,
    color: '#FF9500',
    flex: 1,
    lineHeight: 18,
  },
});
