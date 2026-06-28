import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFeatureFlags } from '../context/FeatureFlagsContext';

interface FeatureGateProps {
  featureKey: string;
  featureName?: string;
  children: React.ReactNode;
}

/**
 * Composant de protection : affiche le contenu enfant si la feature est activée
 * pour l'entreprise courante, sinon affiche un écran "non disponible".
 *
 * Usage :
 *   <FeatureGate featureKey="motos.liste" featureName="Gestion Motos">
 *     <MotosContent />
 *   </FeatureGate>
 */
export const FeatureGate = ({
  featureKey,
  featureName,
  children,
}: FeatureGateProps) => {
  const { isFeatureEnabled } = useFeatureFlags();

  if (!isFeatureEnabled(featureKey)) {
    return (
      <View style={styles.container}>
        <View style={styles.iconWrapper}>
          <Ionicons name="lock-closed" size={52} color="#8E8E93" />
        </View>
        <Text style={styles.title}>Fonctionnalité non activée</Text>
        <Text style={styles.subtitle}>
          {featureName
            ? `Le module "${featureName}" n'est pas inclus dans votre abonnement actuel.`
            : "Ce module n'est pas inclus dans votre abonnement actuel."}
        </Text>
        <View style={styles.contactBox}>
          <Ionicons name="information-circle-outline" size={16} color="#007AFF" />
          <Text style={styles.contactText}>
            Contactez le support pour activer cette fonctionnalité.
          </Text>
        </View>
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
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
    backgroundColor: '#E5E5EA',
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
    backgroundColor: '#EAF4FF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  contactText: {
    fontSize: 13,
    color: '#007AFF',
    flex: 1,
    lineHeight: 18,
  },
});
