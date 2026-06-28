import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { useTheme } from '../../context/ThemeContext';

const { width } = Dimensions.get('window');

// ─── COULEURS DYNAMIQUES ────────────────────────────────────────────────────
const DARK = {
  bg: '#0D0D0D',
  card: '#181818',
  cardBorder: '#252525',
  text: '#F0F0F0',
  subText: '#888888',
  primary: '#0A84FF',
  accent: '#FF6B00',
  separator: '#1E1E1E',
  headerBg: '#111111',
  pill: '#232323',
  pillActive: '#0A84FF',
  price: '#34C759',
};

const LIGHT = {
  bg: '#F5F5F7',
  card: '#FFFFFF',
  cardBorder: '#E5E5EA',
  text: '#1C1C1E',
  subText: '#8E8E93',
  primary: '#007AFF',
  accent: '#FF6B00',
  separator: '#F0F0F2',
  headerBg: '#FFFFFF',
  pill: '#E5E5EA',
  pillActive: '#007AFF',
  price: '#34C759',
};

function useColors() {
  const { isDark, toggleTheme } = useTheme();
  return { C: isDark ? DARK : LIGHT, isDark, toggleTheme };
}

// ─── TYPES ──────────────────────────────────────────────────────────────────
type FeedMoto = {
  id: string;
  marque: string;
  modele: string;
  type: string | null;
  couleur: string | null;
  prix_vente: number | null;
  etat: string | null;
  created_at: string;
  enterprise_id: string | null;
  cylindree: string | null;
  annee_fabrication: number | null;
  numero_chassis: string | null;
  immatriculation: string | null;
  description?: string | null;
  like_count?: number;
  moto_images: { image_uri: string; is_principal: boolean; position: number }[];
  enterprises?: { name: string; logo_url: string | null; phone: string | null; is_active: boolean } | null;
};

type EnterpriseContact = {
  whatsapp: string | null;
  phone1: string | null;
  phone2: string | null;
  localisation: string | null;
  email: string | null;
  description: string | null;
};

const FILTERS = ['Tout', 'Neuf', 'Occasion'] as const;
type Filter = typeof FILTERS[number];

type FeedPub = {
  id: string;
  enterprise_id: string;
  texte: string | null;
  images: string[];
  created_at: string;
  like_count?: number;
  enterprises?: { name: string; logo_url: string | null; is_active: boolean } | null;
};

type FeedItem =
  | { kind: 'moto'; data: FeedMoto }
  | { kind: 'pub';  data: FeedPub  };

// ─── PAGINATION ─────────────────────────────────────────────────────────────
const MOTO_PAGE_SIZE = 12;
const PUB_PAGE_SIZE  = 6;

const MOTO_SELECT = `
  id, marque, modele, type, couleur, prix_vente, etat, created_at, enterprise_id,
  cylindree, annee_fabrication, numero_chassis, immatriculation, like_count,
  moto_images(image_uri, is_principal, position),
  enterprises(name, logo_url, phone, is_active)
`;

const LIKED_MOTOS_KEY = 'LIKED_MOTOS_V1';
const LIKED_PUBS_KEY  = 'LIKED_PUBS_V1';

// ─── UTILITAIRES ────────────────────────────────────────────────────────────
function formatPrice(p: number | null): string {
  if (!p) return 'Prix sur demande';
  return p.toLocaleString('fr-FR') + ' FCFA';
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `Il y a ${days}j`;
  return new Date(dateStr).toLocaleDateString('fr-FR');
}

// ─── AVATAR ENTREPRISE ───────────────────────────────────────────────────────
function EnterpriseAvatar({ name, logoUrl, size = 38 }: { name: string; logoUrl?: string | null; size?: number }) {
  const { C } = useColors();
  const [imgError, setImgError] = useState(false);
  const initial = name ? name.charAt(0).toUpperCase() : '?';

  if (logoUrl && !imgError) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.pill }}
        onError={() => setImgError(true)}
      />
    );
  }
  return (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: C.primary }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.42 }]}>{initial}</Text>
    </View>
  );
}

// ─── CARTE MOTO ─────────────────────────────────────────────────────────────
function MotoCard({ item, onPress, onContact, isLiked, onLike }: {
  item: FeedMoto;
  onPress?: () => void;
  onContact?: () => void;
  isLiked: boolean;
  onLike: () => void;
}) {
  const { C } = useColors();
  const principalImg = item.moto_images?.find(i => i.is_principal) ?? item.moto_images?.[0];
  const imgUri = principalImg?.image_uri;
  const [imgError, setImgError] = useState(false);
  const enterpriseName = item.enterprises?.name ?? 'Entreprise';
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 30 }).start();
  const handlePressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

  const etatBadge = item.etat
    ? item.etat.toLowerCase() === 'neuf'
      ? { label: 'NEUF', color: C.price }
      : { label: 'OCCASION', color: C.accent }
    : null;

  return (
    <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }], backgroundColor: C.card, borderColor: C.cardBorder }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {/* En-tête carte */}
        <View style={styles.cardHeader}>
          <EnterpriseAvatar name={enterpriseName} logoUrl={item.enterprises?.logo_url} />
          <View style={styles.cardHeaderText}>
            <Text style={[styles.enterpriseName, { color: C.text }]} numberOfLines={1}>{enterpriseName}</Text>
            <View style={styles.cardMeta}>
              <Ionicons name="location-outline" size={11} color={C.subText} />
              <Text style={[styles.cardTime, { color: C.subText }]}>{timeAgo(item.created_at)}</Text>
            </View>
          </View>
          {etatBadge && (
            <View style={[styles.etatBadge, { borderColor: etatBadge.color }]}>
              <Text style={[styles.etatBadgeText, { color: etatBadge.color }]}>{etatBadge.label}</Text>
            </View>
          )}
        </View>

        {/* Image */}
        {imgUri && !imgError ? (
          <Image
            source={{ uri: imgUri }}
            style={[styles.motoImage, { backgroundColor: C.pill }]}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={[styles.motoImagePlaceholder, { backgroundColor: C.separator }]}>
            <Ionicons name="bicycle" size={64} color={C.cardBorder} />
          </View>
        )}

        {/* Infos */}
        <View style={styles.cardBody}>
          <Text style={[styles.motoTitle, { color: C.text }]} numberOfLines={1}>
            {item.marque} {item.modele}
          </Text>
          <View style={styles.motoTags}>
            {item.type && (
              <View style={[styles.tag, { backgroundColor: C.pill }]}>
                <Ionicons name="layers-outline" size={12} color={C.subText} />
                <Text style={[styles.tagText, { color: C.subText }]}>{item.type}</Text>
              </View>
            )}
            {item.couleur && (
              <View style={[styles.tag, { backgroundColor: C.pill }]}>
                <Ionicons name="color-palette-outline" size={12} color={C.subText} />
                <Text style={[styles.tagText, { color: C.subText }]}>{item.couleur}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.price, { color: C.price }]}>{formatPrice(item.prix_vente)}</Text>
        </View>

        {/* Actions */}
        <View style={[styles.cardActions, { borderTopColor: C.cardBorder }]}>
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={onLike}>
            <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={19} color={isLiked ? '#FF3B30' : C.subText} />
            <Text style={[styles.actionText, { color: isLiked ? '#FF3B30' : C.subText }]}>
              {(item.like_count ?? 0) > 0 ? String(item.like_count) : "J'aime"}
            </Text>
          </TouchableOpacity>
          <View style={[styles.actionDivider, { backgroundColor: C.cardBorder }]} />
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
            <Ionicons name="share-social-outline" size={19} color={C.subText} />
            <Text style={[styles.actionText, { color: C.subText }]}>Partager</Text>
          </TouchableOpacity>
          <View style={[styles.actionDivider, { backgroundColor: C.cardBorder }]} />
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={onContact}>
            <Ionicons name="call-outline" size={19} color={C.primary} />
            <Text style={[styles.actionText, { color: C.primary }]}>Contacter</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── SECTION TENDANCES ────────────────────────────────────────────────────────
function TrendingSection({
  motos,
  likedMotos,
  onPress,
}: {
  motos: FeedMoto[];
  likedMotos: Set<string>;
  onPress: (moto: FeedMoto) => void;
}) {
  const { C } = useColors();
  const trending = [...motos]
    .filter(m => (m.like_count ?? 0) > 0)
    .sort((a, b) => (b.like_count ?? 0) - (a.like_count ?? 0))
    .slice(0, 6);

  if (trending.length === 0) return null;

  return (
    <View style={{ marginBottom: 4, backgroundColor: C.card, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.cardBorder }}>
      <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name="flame" size={16} color="#FF3B30" />
        <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>En tendance</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, gap: 10 }}>
        {trending.map(moto => {
          const principalImg = moto.moto_images?.find(i => i.is_principal) ?? moto.moto_images?.[0];
          const imgUri = principalImg?.image_uri;
          const isLiked = likedMotos.has(moto.id);
          return (
            <TouchableOpacity
              key={moto.id}
              style={{ width: 130, backgroundColor: C.bg, borderRadius: 12, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.cardBorder }}
              onPress={() => onPress(moto)}
              activeOpacity={0.85}
            >
              {imgUri ? (
                <Image source={{ uri: imgUri }} style={{ width: 130, height: 90 }} resizeMode="cover" />
              ) : (
                <View style={{ width: 130, height: 90, backgroundColor: C.separator, justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="bicycle" size={32} color={C.cardBorder} />
                </View>
              )}
              <View style={{ padding: 7 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.text }} numberOfLines={1}>{moto.marque} {moto.modele}</Text>
                <Text style={{ fontSize: 11, color: C.price, fontWeight: '600', marginTop: 2 }}>{formatPrice(moto.prix_vente)}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 }}>
                  <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={11} color={isLiked ? '#FF3B30' : C.subText} />
                  <Text style={{ fontSize: 11, color: C.subText }}>{moto.like_count ?? 0} like{(moto.like_count ?? 0) > 1 ? 's' : ''}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── EN-TÊTE DU FEED ────────────────────────────────────────────────────────
function FeedHeader({
  isAuthenticated,
  isLoading,
}: {
  isAuthenticated: boolean;
  isLoading: boolean;
}) {
  const { C, isDark, toggleTheme } = useColors();

  return (
    <View style={[styles.feedHeader, { backgroundColor: C.headerBg, borderBottomColor: C.cardBorder }]}>
      <View style={styles.feedHeaderLeft}>
        <View style={[styles.logoCircle, { backgroundColor: C.primary }]}>
          <Ionicons name="bicycle" size={20} color="#fff" />
        </View>
        <View>
          <Text style={[styles.appName, { color: C.text }]}>SenMoto</Text>
          <Text style={[styles.appTagline, { color: C.subText }]}>Catalogue public</Text>
        </View>
      </View>

      <View style={styles.feedHeaderRight}>
        {/* Bouton thème */}
        <TouchableOpacity
          onPress={toggleTheme}
          style={[styles.themeBtn, { backgroundColor: C.pill }]}
          activeOpacity={0.8}
        >
          <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={18} color={C.text} />
        </TouchableOpacity>

        {/* Bouton connexion */}
        <TouchableOpacity
          style={[styles.loginBtn, { backgroundColor: isAuthenticated ? '#1C3A5E' : C.primary }]}
          onPress={() => router.push(isAuthenticated ? '/home' : '/onboarding')}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons
                name={isAuthenticated ? 'person-circle-outline' : 'log-in-outline'}
                size={15}
                color="#fff"
                style={{ marginRight: 5 }}
              />
              <Text style={styles.loginBtnText}>
                {isAuthenticated ? 'Mon Espace' : 'Connexion'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── LISTE VIDE ──────────────────────────────────────────────────────────────
function EmptyFeed() {
  const { C } = useColors();
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name="storefront-outline" size={72} color={C.cardBorder} />
      <Text style={[styles.emptyTitle, { color: C.text }]}>Aucune publication</Text>
      <Text style={[styles.emptyText, { color: C.subText }]}>
        Les entreprises publient leurs motos ici.{'\n'}
        Revenez bientôt ou actualisez la page.
      </Text>
    </View>
  );
}

// ─── ÉCRAN PIN ───────────────────────────────────────────────────────────────
function PinScreen({
  storedPin,
  onSubmit,
  onSwitchUser,
}: {
  storedPin: string | null;
  onSubmit: (pin: string) => void;
  onSwitchUser: () => void;
}) {
  const { C } = useColors();
  const [pin, setPin] = useState('');

  return (
    <SafeAreaView style={[styles.pinContainer, { backgroundColor: C.bg, paddingTop: 0 }]}>
      <View style={[styles.pinCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
        <Ionicons name="lock-closed" size={48} color={C.primary} style={{ marginBottom: 20 }} />
        <Text style={[styles.pinTitle, { color: C.text }]}>{storedPin ? '🔐 Accès verrouillé' : '🛡️ Sécurisez votre accès'}</Text>
        <Text style={[styles.pinSubtitle, { color: C.subText }]}>Entrez votre code PIN pour continuer</Text>
        <TextInput
          style={[styles.pinInput, { borderColor: C.primary, color: C.text }]}
          placeholder="• • • •"
          placeholderTextColor={C.subText}
          keyboardType="numeric"
          secureTextEntry
          maxLength={4}
          value={pin}
          onChangeText={setPin}
          autoFocus
        />
        <TouchableOpacity
          style={[styles.pinSubmitBtn, { backgroundColor: C.primary }]}
          onPress={() => onSubmit(pin)}
          activeOpacity={0.85}
        >
          <Text style={styles.pinSubmitText}>{storedPin ? 'Déverrouiller' : 'Enregistrer le PIN'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onSwitchUser} style={{ marginTop: 24 }}>
          <Text style={{ color: '#FF3B30', textAlign: 'center' }}>Changer d'utilisateur</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── IMAGE GRID (style Facebook) ─────────────────────────────────────────────
function ImageGrid({
  images,
  onPressImage,
}: {
  images: string[];
  onPressImage: (index: number) => void;
}) {
  const { C } = useColors();
  const n = images.length;
  if (n === 0) return null;

  const GAP = 2;
  const W = width - 20; // largeur de la carte sans marges

  const imgStyle = (w: number, h: number) => ({
    width: w,
    height: h,
    backgroundColor: C.pill,
  });

  if (n === 1) {
    return (
      <TouchableOpacity onPress={() => onPressImage(0)} activeOpacity={0.9}>
        <Image source={{ uri: images[0] }} style={imgStyle(W, 260)} resizeMode="cover" />
      </TouchableOpacity>
    );
  }

  if (n === 2) {
    const iw = (W - GAP) / 2;
    return (
      <View style={{ flexDirection: 'row', gap: GAP }}>
        {images.map((img, i) => (
          <TouchableOpacity key={i} onPress={() => onPressImage(i)} activeOpacity={0.9}>
            <Image source={{ uri: img }} style={imgStyle(iw, 210)} resizeMode="cover" />
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  if (n === 3) {
    const leftW = (W - GAP) * 0.56;
    const rightW = W - GAP - leftW;
    const rowH = 230;
    return (
      <View style={{ flexDirection: 'row', gap: GAP }}>
        <TouchableOpacity onPress={() => onPressImage(0)} activeOpacity={0.9}>
          <Image source={{ uri: images[0] }} style={imgStyle(leftW, rowH)} resizeMode="cover" />
        </TouchableOpacity>
        <View style={{ gap: GAP }}>
          {images.slice(1).map((img, i) => (
            <TouchableOpacity key={i} onPress={() => onPressImage(i + 1)} activeOpacity={0.9}>
              <Image
                source={{ uri: img }}
                style={imgStyle(rightW, (rowH - GAP) / 2)}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  if (n === 4) {
    const iw = (W - GAP) / 2;
    return (
      <View style={{ gap: GAP }}>
        <View style={{ flexDirection: 'row', gap: GAP }}>
          {images.slice(0, 2).map((img, i) => (
            <TouchableOpacity key={i} onPress={() => onPressImage(i)} activeOpacity={0.9}>
              <Image source={{ uri: img }} style={imgStyle(iw, 175)} resizeMode="cover" />
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: GAP }}>
          {images.slice(2, 4).map((img, i) => (
            <TouchableOpacity key={i} onPress={() => onPressImage(i + 2)} activeOpacity={0.9}>
              <Image source={{ uri: img }} style={imgStyle(iw, 175)} resizeMode="cover" />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  // n ≥ 5 : 2 grandes + 3 petites, la dernière visible porte le compteur
  const topW = (W - GAP) / 2;
  const botW = (W - 2 * GAP) / 3;
  const shown = images.slice(0, 5);
  const remaining = n - 5; // images cachées

  return (
    <View style={{ gap: GAP }}>
      <View style={{ flexDirection: 'row', gap: GAP }}>
        {shown.slice(0, 2).map((img, i) => (
          <TouchableOpacity key={i} onPress={() => onPressImage(i)} activeOpacity={0.9}>
            <Image source={{ uri: img }} style={imgStyle(topW, 195)} resizeMode="cover" />
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: GAP }}>
        {shown.slice(2).map((img, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => onPressImage(i + 2)}
            activeOpacity={0.9}
            style={{ position: 'relative' }}
          >
            <Image source={{ uri: img }} style={imgStyle(botW, 128)} resizeMode="cover" />
            {i === 2 && remaining > 0 && (
              <View
                style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.52)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>
                  +{remaining}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── GALERIE PLEIN ÉCRAN ──────────────────────────────────────────────────────
function ImageGalleryModal({
  images,
  startIndex,
  onClose,
}: {
  images: string[];
  startIndex: number;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);

  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {/* Fermer */}
        <TouchableOpacity
          onPress={onClose}
          style={{ position: 'absolute', top: 50, right: 16, zIndex: 10, padding: 8 }}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={30} color="#fff" />
        </TouchableOpacity>

        {/* Compteur */}
        <View
          style={{
            position: 'absolute',
            top: 54,
            left: 0,
            right: 0,
            alignItems: 'center',
            zIndex: 10,
          }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600' }}>
            {currentIndex + 1} / {images.length}
          </Text>
        </View>

        <FlatList
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex}
          keyExtractor={(_, i) => String(i)}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / width);
            setCurrentIndex(idx);
          }}
          renderItem={({ item }) => (
            <Image
              source={{ uri: item }}
              style={{ width, height: '100%' }}
              resizeMode="contain"
            />
          )}
        />
      </View>
    </Modal>
  );
}

// ─── CARTE PUBLICATION (style Facebook) ──────────────────────────────────────
function PublicationCard({
  item,
  onContact,
  isLiked,
  onLike,
}: {
  item: FeedPub;
  onContact: () => void;
  isLiked: boolean;
  onLike: () => void;
}) {
  const { C } = useColors();
  const [expanded, setExpanded] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const enterpriseName = item.enterprises?.name ?? 'Entreprise';
  const TEXT_LIMIT = 120;
  const isLong = (item.texte?.length ?? 0) > TEXT_LIMIT;

  const openGallery = (i: number) => {
    setGalleryIndex(i);
    setGalleryOpen(true);
  };

  return (
    <View style={[styles.card, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
      {/* En-tête */}
      <View style={styles.cardHeader}>
        <EnterpriseAvatar name={enterpriseName} logoUrl={item.enterprises?.logo_url} />
        <View style={styles.cardHeaderText}>
          <Text style={[styles.enterpriseName, { color: C.text }]} numberOfLines={1}>
            {enterpriseName}
          </Text>
          <View style={styles.cardMeta}>
            <Ionicons name="globe-outline" size={11} color={C.subText} />
            <Text style={[styles.cardTime, { color: C.subText }]}>{timeAgo(item.created_at)}</Text>
          </View>
        </View>
        <View style={[styles.etatBadge, { borderColor: C.primary }]}>
          <Text style={[styles.etatBadgeText, { color: C.primary }]}>OFFRE</Text>
        </View>
      </View>

      {/* Texte */}
      {item.texte ? (
        <TouchableOpacity
          style={{ paddingHorizontal: 13, paddingBottom: 10 }}
          activeOpacity={0.7}
          onPress={() => setExpanded(!expanded)}
        >
          <Text
            style={{ color: C.text, fontSize: 14, lineHeight: 21 }}
            numberOfLines={expanded ? undefined : 3}
          >
            {item.texte}
          </Text>
          {!expanded && isLong ? (
            <Text style={{ color: C.primary, fontSize: 13, fontWeight: '600', marginTop: 4 }}>
              Voir plus
            </Text>
          ) : expanded ? (
            <Text style={{ color: C.primary, fontSize: 13, fontWeight: '600', marginTop: 4 }}>
              Voir moins
            </Text>
          ) : null}
        </TouchableOpacity>
      ) : null}

      {/* Grille d'images */}
      {item.images && item.images.length > 0 ? (
        <View style={{ overflow: 'hidden' }}>
          <ImageGrid images={item.images} onPressImage={openGallery} />
        </View>
      ) : null}

      {/* Actions */}
      <View style={[styles.cardActions, { borderTopColor: C.cardBorder }]}>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={onLike}>
          <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={19} color={isLiked ? '#FF3B30' : C.subText} />
          <Text style={[styles.actionText, { color: isLiked ? '#FF3B30' : C.subText }]}>
            {(item.like_count ?? 0) > 0 ? String(item.like_count) : "J'aime"}
          </Text>
        </TouchableOpacity>
        <View style={[styles.actionDivider, { backgroundColor: C.cardBorder }]} />
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
          <Ionicons name="share-social-outline" size={19} color={C.subText} />
          <Text style={[styles.actionText, { color: C.subText }]}>Partager</Text>
        </TouchableOpacity>
        <View style={[styles.actionDivider, { backgroundColor: C.cardBorder }]} />
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={onContact}>
          <Ionicons name="call-outline" size={19} color={C.primary} />
          <Text style={[styles.actionText, { color: C.primary }]}>Contacter</Text>
        </TouchableOpacity>
      </View>

      {galleryOpen && (
        <ImageGalleryModal
          images={item.images}
          startIndex={galleryIndex}
          onClose={() => setGalleryOpen(false)}
        />
      )}
    </View>
  );
}

// ─── MODAL CONTACT (publication) ─────────────────────────────────────────────
function PubContactModal({
  pub,
  onClose,
}: {
  pub: FeedPub;
  onClose: () => void;
}) {
  const { C } = useColors();
  const { height: screenHeight } = Dimensions.get('window');
  const enterpriseName = pub.enterprises?.name ?? "l'entreprise";

  const [contactInfo, setContactInfo] = useState<EnterpriseContact | null>(null);
  const [contactLoading, setContactLoading] = useState(true);

  useEffect(() => {
    if (!pub.enterprise_id) { setContactLoading(false); return; }
    supabase
      .from('enterprise_contacts')
      .select('whatsapp, phone1, phone2, localisation, email, description')
      .eq('enterprise_id', pub.enterprise_id)
      .maybeSingle()
      .then(({ data }) => {
        setContactInfo(data ?? null);
        setContactLoading(false);
      });
  }, [pub.enterprise_id]);

  const waNumber  = contactInfo?.whatsapp ?? null;
  const callNumber = contactInfo?.phone1  ?? null;
  const phone2    = contactInfo?.phone2   ?? null;
  const gpsLoc    = contactInfo?.localisation ?? null;

  const openWhatsApp = () => {
    if (!waNumber)
      return Alert.alert('Indisponible', 'WhatsApp non renseigné pour cette entreprise.');
    const phone = waNumber.replace(/\D/g, '');
    const text  = `Bonjour, j'ai vu votre publication et je souhaite plus d'informations.`;
    Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`);
  };

  const openCall = (num: string) => Linking.openURL(`tel:${num}`);

  const openGPS = async () => {
    if (!gpsLoc)
      return Alert.alert('Indisponible', "Cet établissement n'a pas renseigné sa position GPS.");
    const parts = gpsLoc.split(',').map(Number);
    if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1]))
      return Alert.alert('Erreur', 'Coordonnées GPS invalides.');
    const [lat, lng] = parts;
    const mapsUrl =
      Platform.OS === 'ios'
        ? `maps://maps.apple.com/?daddr=${lat},${lng}`
        : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    const canOpen = await Linking.canOpenURL(mapsUrl);
    Linking.openURL(
      canOpen ? mapsUrl : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    );
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.contactOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ width: '100%', maxHeight: screenHeight * 0.92 }}
        >
          <View style={[styles.contactSheet, { backgroundColor: C.card }]}>
            {/* Header */}
            <View style={[styles.contactSheetHeader, { borderBottomColor: C.cardBorder }]}>
              <View style={[styles.contactSheetDrag, { backgroundColor: C.cardBorder }]} />
              <Text style={[styles.contactSheetTitle, { color: C.text }]}>
                {`Contacter ${enterpriseName}`}
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.contactSheetClose}>
                <Ionicons name="close" size={22} color={C.text} />
              </TouchableOpacity>
            </View>

            {contactLoading ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator color={C.primary} />
              </View>
            ) : (
              <View style={styles.contactOptionsList}>
                {/* WhatsApp */}
                <TouchableOpacity
                  style={[styles.contactOptionRow, { borderBottomColor: C.cardBorder }]}
                  onPress={openWhatsApp}
                  activeOpacity={0.75}
                >
                  <View style={[styles.contactOptionIcon, { backgroundColor: '#25D366' }]}>
                    <Ionicons name="logo-whatsapp" size={24} color="#fff" />
                  </View>
                  <View style={styles.contactOptionText}>
                    <Text style={[styles.contactOptionLabel, { color: C.text }]}>WhatsApp</Text>
                    <Text style={[styles.contactOptionSub, { color: C.subText }]}>
                      {waNumber ?? 'Non disponible'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.subText} />
                </TouchableOpacity>

                {/* Appel principal */}
                <TouchableOpacity
                  style={[styles.contactOptionRow, { borderBottomColor: C.cardBorder }]}
                  onPress={() =>
                    callNumber
                      ? openCall(callNumber)
                      : Alert.alert('Indisponible', 'Numéro non renseigné.')
                  }
                  activeOpacity={0.75}
                >
                  <View style={[styles.contactOptionIcon, { backgroundColor: C.price }]}>
                    <Ionicons name="call" size={24} color="#fff" />
                  </View>
                  <View style={styles.contactOptionText}>
                    <Text style={[styles.contactOptionLabel, { color: C.text }]}>Appel / SMS</Text>
                    <Text style={[styles.contactOptionSub, { color: C.subText }]}>
                      {callNumber ?? 'Non disponible'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.subText} />
                </TouchableOpacity>

                {/* Téléphone 2 */}
                {phone2 ? (
                  <TouchableOpacity
                    style={[styles.contactOptionRow, { borderBottomColor: C.cardBorder }]}
                    onPress={() => openCall(phone2)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.contactOptionIcon, { backgroundColor: C.price }]}>
                      <Ionicons name="call-outline" size={24} color="#fff" />
                    </View>
                    <View style={styles.contactOptionText}>
                      <Text style={[styles.contactOptionLabel, { color: C.text }]}>Téléphone 2</Text>
                      <Text style={[styles.contactOptionSub, { color: C.subText }]}>{phone2}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={C.subText} />
                  </TouchableOpacity>
                ) : null}

                {/* Chat */}
                <TouchableOpacity
                  style={[styles.contactOptionRow, { borderBottomColor: C.cardBorder }]}
                  onPress={() => {
                    if (!pub.enterprise_id) return;
                    onClose();
                    router.push({
                      pathname: '/chat',
                      params: {
                        enterprise_id: pub.enterprise_id,
                        enterprise_name: pub.enterprises?.name ?? 'Entreprise',
                      },
                    } as any);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={[styles.contactOptionIcon, { backgroundColor: C.primary }]}>
                    <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
                  </View>
                  <View style={styles.contactOptionText}>
                    <Text style={[styles.contactOptionLabel, { color: C.text }]}>Chat en temps réel</Text>
                    <Text style={[styles.contactOptionSub, { color: C.subText }]}>Messagerie directe</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.subText} />
                </TouchableOpacity>

                {/* GPS */}
                <TouchableOpacity
                  style={[styles.contactOptionRow, { borderBottomWidth: 0 }]}
                  onPress={openGPS}
                  activeOpacity={0.75}
                >
                  <View style={[styles.contactOptionIcon, { backgroundColor: C.accent }]}>
                    <Ionicons name="navigate" size={24} color="#fff" />
                  </View>
                  <View style={styles.contactOptionText}>
                    <Text style={[styles.contactOptionLabel, { color: C.text }]}>Itinéraire / GPS</Text>
                    <Text style={[styles.contactOptionSub, { color: C.subText }]}>
                      {gpsLoc ? 'Ouvrir dans Maps' : 'Position non renseignée'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.subText} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── COMPOSANT PRINCIPAL ─────────────────────────────────────────────────────
export default function FeedScreen() {
  const { C } = useColors();
  const { tenant, loading: authLoading, isAuthenticated, pendingState, isSuperAdmin } = useTenant();

  const [motos, setMotos] = useState<FeedMoto[]>([]);
  const [publications, setPublications] = useState<FeedPub[]>([]);
  const [filtered, setFiltered] = useState<FeedMoto[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [motosOffset, setMotosOffset] = useState(0);
  const [pubsOffset, setPubsOffset] = useState(0);
  const [hasMoreMotos, setHasMoreMotos] = useState(true);
  const [hasMorePubs, setHasMorePubs] = useState(true);
  const loadingMoreRef = useRef(false);

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<Filter>('Tout');
  const [detailMoto, setDetailMoto] = useState<FeedMoto | null>(null);
  const [contactMoto, setContactMoto] = useState<FeedMoto | null>(null);
  const [pubContact, setPubContact] = useState<FeedPub | null>(null);

  const [showPin, setShowPin] = useState(false);
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [likedMotos, setLikedMotos] = useState<Set<string>>(new Set());
  const [likedPubs, setLikedPubs]   = useState<Set<string>>(new Set());

  useEffect(() => { fetchFeed(); }, []);

  useEffect(() => {
    Promise.all([
      SecureStore.getItemAsync(LIKED_MOTOS_KEY),
      SecureStore.getItemAsync(LIKED_PUBS_KEY),
    ]).then(([ms, ps]) => {
      if (ms) setLikedMotos(new Set(JSON.parse(ms)));
      if (ps) setLikedPubs(new Set(JSON.parse(ps)));
    });
  }, []);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    handleAuthRouting();
  }, [authLoading, isAuthenticated, tenant, pendingState]);

  useEffect(() => {
    let data = motos;
    if (activeFilter !== 'Tout') {
      const etat = activeFilter === 'Neuf' ? 'neuf' : 'occasion';
      data = data.filter(m => m.etat?.toLowerCase() === etat);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(m =>
        m.marque.toLowerCase().includes(q) ||
        m.modele?.toLowerCase().includes(q) ||
        m.type?.toLowerCase().includes(q) ||
        m.couleur?.toLowerCase().includes(q) ||
        m.enterprises?.name?.toLowerCase().includes(q)
      );
    }
    setFiltered(data);
  }, [motos, activeFilter, search]);

  // ── Fusionner motos et publications dans un seul fil chronologique ──────────
  useEffect(() => {
    const motoItems: FeedItem[] = filtered.map(m => ({ kind: 'moto', data: m }));

    let pubItems: FeedItem[] = [];
    if (activeFilter === 'Tout') {
      let pubs = publications;
      if (search.trim()) {
        const q = search.toLowerCase();
        pubs = pubs.filter(
          p =>
            p.texte?.toLowerCase().includes(q) ||
            p.enterprises?.name?.toLowerCase().includes(q),
        );
      }
      pubItems = pubs.map(p => ({ kind: 'pub', data: p }));
    }

    const merged = [...motoItems, ...pubItems].sort(
      (a, b) =>
        new Date(b.data.created_at).getTime() -
        new Date(a.data.created_at).getTime(),
    );
    setFeedItems(merged);
  }, [filtered, publications, activeFilter, search]);

  const fetchFeed = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
      setMotosOffset(0);
      setPubsOffset(0);
      setHasMoreMotos(true);
      setHasMorePubs(true);
    } else {
      setFeedLoading(true);
    }

    // Lance les deux fetchs EN PARALLÈLE — on n'attend plus l'un pour lancer l'autre
    const motoFetch = supabase
      .from('motos')
      .select(MOTO_SELECT)
      .order('created_at', { ascending: false })
      .range(0, MOTO_PAGE_SIZE - 1);

    const pubFetch = supabase
      .from('enterprise_publications')
      .select('*, enterprises(name, logo_url, is_active)')
      .order('created_at', { ascending: false })
      .range(0, PUB_PAGE_SIZE - 1);

    // Dès que les motos arrivent → on enlève le spinner et on affiche
    const processMotos = motoFetch.then(({ data, error }) => {
      if (error) console.error('Erreur fetchMotos:', error.message);
      if (data) {
        const active = (data as any[]).filter(m => m.enterprises?.is_active !== false);
        setMotos(active as unknown as FeedMoto[]);
        setHasMoreMotos(data.length === MOTO_PAGE_SIZE);
        setMotosOffset(MOTO_PAGE_SIZE);
      }
      setFeedLoading(false); // Affiche les motos sans attendre les pubs
    });

    // Les pubs s'insèrent dans le fil quand elles arrivent (en arrière-plan)
    const processPubs = pubFetch.then(({ data }) => {
      if (data) {
        const activePubs = (data as any[]).filter(p => p.enterprises?.is_active !== false);
        setPublications(activePubs as FeedPub[]);
        setHasMorePubs(data.length === PUB_PAGE_SIZE);
        setPubsOffset(PUB_PAGE_SIZE);
      }
    });

    await Promise.all([processMotos, processPubs]);
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (loadingMoreRef.current || (!hasMoreMotos && !hasMorePubs)) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);

    try {
      await Promise.all([
        hasMoreMotos
          ? supabase
              .from('motos')
              .select(MOTO_SELECT)
              .order('created_at', { ascending: false })
              .range(motosOffset, motosOffset + MOTO_PAGE_SIZE - 1)
              .then(({ data }) => {
                if (!data) return;
                const active = (data as any[]).filter(m => m.enterprises?.is_active !== false);
                setMotos(prev => [...prev, ...active as unknown as FeedMoto[]]);
                setHasMoreMotos(data.length === MOTO_PAGE_SIZE);
                setMotosOffset(prev => prev + MOTO_PAGE_SIZE);
              })
          : Promise.resolve(),
        hasMorePubs
          ? supabase
              .from('enterprise_publications')
              .select('*, enterprises(name, logo_url, is_active)')
              .order('created_at', { ascending: false })
              .range(pubsOffset, pubsOffset + PUB_PAGE_SIZE - 1)
              .then(({ data }) => {
                if (!data) return;
                const activePubs = (data as any[]).filter(p => p.enterprises?.is_active !== false);
                setPublications(prev => [...prev, ...activePubs as FeedPub[]]);
                setHasMorePubs(data.length === PUB_PAGE_SIZE);
                setPubsOffset(prev => prev + PUB_PAGE_SIZE);
              })
          : Promise.resolve(),
      ]);
    } catch (e) {
      console.error('Exception loadMore:', e);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  };

  const handleAuthRouting = async () => {
    if (pendingState) { router.replace('/pending'); return; }
    if (isSuperAdmin) { router.replace('/admin/enterprises'); return; }
    if (tenant) {
      const saved = await SecureStore.getItemAsync(`USER_PIN_${tenant.user_id}`);
      setStoredPin(saved);
      if (saved) {
        const bio = await LocalAuthentication.authenticateAsync({ promptMessage: 'Accès SenMoto' });
        if (bio.success) { router.replace('/home'); return; }
        setShowPin(true);
      } else {
        router.replace('/home');
      }
    }
  };

  const handlePinSubmit = async (pin: string) => {
    if (!tenant) return;
    const pinKey = `USER_PIN_${tenant.user_id}`;
    if (!storedPin) {
      if (pin.length !== 4) { Alert.alert('Erreur', '4 chiffres requis.'); return; }
      await SecureStore.setItemAsync(pinKey, pin);
      router.replace('/home');
    } else if (pin === storedPin) {
      router.replace('/home');
    } else {
      Alert.alert('PIN incorrect', 'Veuillez réessayer.');
    }
  };

  const handleMotoLike = async (moto: FeedMoto) => {
    const isNowLiked = !likedMotos.has(moto.id);
    const next = new Set(likedMotos);
    isNowLiked ? next.add(moto.id) : next.delete(moto.id);
    setLikedMotos(next);
    SecureStore.setItemAsync(LIKED_MOTOS_KEY, JSON.stringify([...next]));
    const delta = isNowLiked ? 1 : -1;
    setMotos(prev => prev.map(m =>
      m.id === moto.id ? { ...m, like_count: Math.max(0, (m.like_count ?? 0) + delta) } : m
    ));
    supabase.rpc('toggle_moto_like', { p_moto_id: moto.id, p_increment: isNowLiked });
  };

  const handlePubLike = async (pub: FeedPub) => {
    const isNowLiked = !likedPubs.has(pub.id);
    const next = new Set(likedPubs);
    isNowLiked ? next.add(pub.id) : next.delete(pub.id);
    setLikedPubs(next);
    SecureStore.setItemAsync(LIKED_PUBS_KEY, JSON.stringify([...next]));
    const delta = isNowLiked ? 1 : -1;
    setPublications(prev => prev.map(p =>
      p.id === pub.id ? { ...p, like_count: Math.max(0, (p.like_count ?? 0) + delta) } : p
    ));
    supabase.rpc('toggle_pub_like', { p_pub_id: pub.id, p_increment: isNowLiked });
  };

  const handleSwitchUser = async () => {
    await supabase.auth.signOut();
    await SecureStore.deleteItemAsync('LAST_USER_ID');
    setShowPin(false);
    router.replace('/onboarding');
  };

  if (showPin) {
    return <PinScreen storedPin={storedPin} onSubmit={handlePinSubmit} onSwitchUser={handleSwitchUser} />;
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: C.bg, paddingTop: 0 }]}>
      <FeedHeader isAuthenticated={isAuthenticated} isLoading={authLoading} />

      {/* Barre de recherche */}
      <View style={[styles.searchBar, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
        <Ionicons name="search" size={16} color={C.subText} />
        <TextInput
          style={[styles.searchInput, { color: C.text }]}
          placeholder="Rechercher une moto, marque, couleur..."
          placeholderTextColor={C.subText}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={C.subText} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filtres pills */}
      <View style={styles.filtersRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterPill,
              { backgroundColor: activeFilter === f ? C.pillActive : C.pill, borderColor: C.cardBorder },
            ]}
            onPress={() => setActiveFilter(f)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterPillText, { color: activeFilter === f ? '#fff' : C.subText }]}>{f}</Text>
          </TouchableOpacity>
        ))}
        <Text style={[styles.resultCount, { color: C.subText }]}>
          {feedItems.length} résultat{feedItems.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Feed */}
      {feedLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={[styles.loadingText, { color: C.subText }]}>Chargement des publications...</Text>
        </View>
      ) : (
        <FlatList
          data={feedItems}
          keyExtractor={item => item.kind + '_' + item.data.id}
          ListHeaderComponent={
            <TrendingSection
              motos={motos}
              likedMotos={likedMotos}
              onPress={(moto) => setDetailMoto(moto)}
            />
          }
          renderItem={({ item }) => {
            if (item.kind === 'moto') {
              return (
                <MotoCard
                  item={item.data}
                  onPress={() => setDetailMoto(item.data)}
                  onContact={() => setContactMoto(item.data)}
                  isLiked={likedMotos.has(item.data.id)}
                  onLike={() => handleMotoLike(item.data)}
                />
              );
            }
            return (
              <PublicationCard
                item={item.data}
                onContact={() => setPubContact(item.data)}
                isLiked={likedPubs.has(item.data.id)}
                onLike={() => handlePubLike(item.data)}
              />
            );
          }}
          ListEmptyComponent={<EmptyFeed />}
          contentContainerStyle={feedItems.length === 0 ? styles.emptyList : styles.feedList}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={C.primary} />
                <Text style={[styles.footerLoaderText, { color: C.subText }]}>Chargement...</Text>
              </View>
            ) : (!hasMoreMotos && !hasMorePubs && feedItems.length > 0) ? (
              <Text style={[styles.footerEnd, { color: C.subText }]}>— Fin du fil —</Text>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchFeed(true)}
              tintColor={C.primary}
              colors={[C.primary]}
            />
          }
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: C.separator }]} />}
        />
      )}

      {detailMoto && (
        <MotoDetailModal
          moto={detailMoto}
          onClose={() => setDetailMoto(null)}
          onContact={() => { const m = detailMoto; setDetailMoto(null); setContactMoto(m); }}
        />
      )}

      {contactMoto && (
        <ContactModal
          moto={contactMoto}
          onClose={() => setContactMoto(null)}
        />
      )}

      {pubContact && (
        <PubContactModal
          pub={pubContact}
          onClose={() => setPubContact(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ─── MODAL DÉTAIL MOTO ───────────────────────────────────────────────────────
function MotoDetailModal({ moto, onClose, onContact }: { moto: FeedMoto; onClose: () => void; onContact: () => void }) {
  const { C } = useColors();
  const imgs = [...(moto.moto_images || [])].sort((a, b) => {
    if (a.is_principal && !b.is_principal) return -1;
    if (!a.is_principal && b.is_principal) return 1;
    return (a.position ?? 0) - (b.position ?? 0);
  });
  const enterpriseName = moto.enterprises?.name ?? 'Entreprise';

  const rows: { label: string; value: string }[] = [
    moto.marque ? { label: 'Marque', value: moto.marque } : null,
    moto.modele ? { label: 'Modèle', value: moto.modele } : null,
    moto.type ? { label: 'Type', value: moto.type } : null,
    moto.etat ? { label: 'État', value: moto.etat } : null,
    moto.couleur ? { label: 'Couleur', value: moto.couleur } : null,
    moto.cylindree ? { label: 'Cylindrée', value: moto.cylindree } : null,
    moto.annee_fabrication ? { label: 'Année', value: String(moto.annee_fabrication) } : null,
    moto.immatriculation ? { label: 'Immatriculation', value: moto.immatriculation } : null,
    moto.numero_chassis ? { label: 'N° châssis', value: moto.numero_chassis } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.detailSafeArea, { backgroundColor: C.bg }]}>
        <View style={[styles.detailHeader, { backgroundColor: C.headerBg, borderBottomColor: C.cardBorder }]}>
          <TouchableOpacity onPress={onClose} style={styles.detailCloseBtn}>
            <Ionicons name="arrow-back" size={24} color={C.text} />
          </TouchableOpacity>
          <Text style={[styles.detailHeaderTitle, { color: C.text }]} numberOfLines={1}>
            {moto.marque} {moto.modele}
          </Text>
          <TouchableOpacity onPress={onContact} style={styles.detailContactBtn}>
            <Ionicons name="call-outline" size={20} color={C.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {imgs.length > 0 ? (
            <FlatList
              data={imgs}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(img, i) => img.image_uri + i}
              renderItem={({ item }) => (
                <Image source={{ uri: item.image_uri }} style={[styles.detailFullImage, { backgroundColor: C.pill }]} resizeMode="cover" />
              )}
            />
          ) : (
            <View style={[styles.detailNoImgBox, { backgroundColor: C.separator }]}>
              <Ionicons name="bicycle" size={72} color={C.cardBorder} />
              <Text style={{ color: C.subText, marginTop: 10 }}>Pas de photo disponible</Text>
            </View>
          )}
          {imgs.length > 1 && (
            <Text style={[styles.swipeHint, { color: C.subText }]}>{imgs.length} photos — glissez ←→</Text>
          )}

          <View style={styles.detailPriceRow}>
            <Text style={[styles.detailPrice, { color: C.price }]}>{formatPrice(moto.prix_vente)}</Text>
            {moto.etat && (
              <View style={[styles.detailEtatBadge, { borderColor: moto.etat.toLowerCase() === 'neuf' ? C.price : C.accent }]}>
                <Text style={[styles.detailEtatText, { color: moto.etat.toLowerCase() === 'neuf' ? C.price : C.accent }]}>
                  {moto.etat.toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          <View style={[styles.detailEnterpriseRow, { borderBottomColor: C.cardBorder }]}>
            <EnterpriseAvatar name={enterpriseName} logoUrl={moto.enterprises?.logo_url} size={36} />
            <Text style={[styles.detailEnterpriseLabel, { color: C.text }]}>{enterpriseName}</Text>
            <Text style={[styles.detailTimeLabel, { color: C.subText }]}>{timeAgo(moto.created_at)}</Text>
          </View>

          {moto.description ? (
            <View style={styles.detailSection}>
              <Text style={[styles.detailSectionTitle, { color: C.subText }]}>Description</Text>
              <Text style={[styles.detailDescText, { color: C.text }]}>{moto.description}</Text>
            </View>
          ) : null}

          <View style={styles.detailSection}>
            <Text style={[styles.detailSectionTitle, { color: C.subText }]}>Caractéristiques</Text>
            {rows.map((r, i) => (
              <View key={i} style={[styles.detailRow, i < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.cardBorder }]}>
                <Text style={[styles.detailLabel, { color: C.subText }]}>{r.label}</Text>
                <Text style={[styles.detailValue, { color: C.text }]}>{r.value}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={[styles.detailBottomBar, { borderTopColor: C.cardBorder, backgroundColor: C.headerBg }]}>
          <TouchableOpacity style={[styles.detailContactBtnFull, { backgroundColor: C.primary }]} onPress={onContact} activeOpacity={0.85}>
            <Ionicons name="call-outline" size={20} color="#fff" />
            <Text style={styles.detailContactBtnText}>Contacter l'entreprise</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── MODAL CONTACT ENTREPRISE ────────────────────────────────────────────────
function ContactModal({ moto, onClose }: { moto: FeedMoto; onClose: () => void }) {
  const { C } = useColors();
  const { height: screenHeight } = Dimensions.get('window');
  const enterpriseName = moto.enterprises?.name ?? "l'entreprise";

  // Contacts configurés par l'admin de l'entreprise
  const [contactInfo, setContactInfo] = useState<EnterpriseContact | null>(null);
  const [contactLoading, setContactLoading] = useState(true);

  // Charger les contacts de l'entreprise depuis enterprise_contacts
  useEffect(() => {
    if (!moto.enterprise_id) { setContactLoading(false); return; }
    supabase
      .from('enterprise_contacts')
      .select('whatsapp, phone1, phone2, localisation, email, description')
      .eq('enterprise_id', moto.enterprise_id)
      .maybeSingle()
      .then(({ data }) => {
        setContactInfo(data ?? null);
        setContactLoading(false);
      });
  }, [moto.enterprise_id]);

  // Numéros effectifs (priorité enterprise_contacts, fallback enterprises.phone)
  const waNumber = contactInfo?.whatsapp ?? moto.enterprises?.phone ?? null;
  const callNumber = contactInfo?.phone1 ?? moto.enterprises?.phone ?? null;
  const phone2 = contactInfo?.phone2 ?? null;
  const gpsLoc = contactInfo?.localisation ?? null;

  const openWhatsApp = () => {
    if (!waNumber) return Alert.alert('Indisponible', 'Numéro WhatsApp non renseigné pour cette entreprise.');
    const phone = waNumber.replace(/\D/g, '');
    const motoName = [moto.marque, moto.modele, moto.type].filter(Boolean).join(' ');
    const price = moto.prix_vente ? `${moto.prix_vente.toLocaleString('fr-FR')} FCFA` : 'Prix sur demande';
    const details = [
      moto.etat ? `État : ${moto.etat}` : null,
      moto.couleur ? `Couleur : ${moto.couleur}` : null,
      moto.cylindree ? `Cylindrée : ${moto.cylindree}` : null,
    ].filter(Boolean).join('\n');
    const principalImg = moto.moto_images?.find(i => i.is_principal) ?? moto.moto_images?.[0];
    const imgUri = principalImg?.image_uri;
    const imgLine = imgUri && imgUri.startsWith('http') ? `\n📸 Photo : ${imgUri}` : '';
    const text = `Bonjour, je suis intéressé(e) par votre moto :\n\n*${motoName}*\nPrix : ${price}${details ? '\n' + details : ''}${imgLine}\n\nPouvez-vous me donner plus d'informations ?`;
    Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`);
  };

  const openCall = (num: string) => {
    Linking.openURL(`tel:${num}`);
  };

  const openGPS = async () => {
    if (!gpsLoc) return Alert.alert('Indisponible', "Cet établissement n'a pas renseigné sa position GPS.");
    const parts = gpsLoc.split(',').map(Number);
    if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return Alert.alert('Erreur', 'Coordonnées GPS invalides.');
    const [lat, lng] = parts;
    const mapsUrl = Platform.OS === 'ios'
      ? `maps://maps.apple.com/?daddr=${lat},${lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    const canOpen = await Linking.canOpenURL(mapsUrl);
    Linking.openURL(canOpen ? mapsUrl : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.contactOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ width: '100%', maxHeight: screenHeight * 0.92 }}
        >
          <View style={[styles.contactSheet, { backgroundColor: C.card }]}>
            {/* Header */}
            <View style={[styles.contactSheetHeader, { borderBottomColor: C.cardBorder }]}>
              <View style={[styles.contactSheetDrag, { backgroundColor: C.cardBorder }]} />
              <Text style={[styles.contactSheetTitle, { color: C.text }]}>
                {`Contacter ${enterpriseName}`}
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.contactSheetClose}>
                <Ionicons name="close" size={22} color={C.text} />
              </TouchableOpacity>
            </View>

            {contactLoading ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator color={C.primary} />
              </View>
            ) : (
              /* Options de contact */
              <View style={styles.contactOptionsList}>
                {/* WhatsApp */}
                <TouchableOpacity
                  style={[styles.contactOptionRow, { borderBottomColor: C.cardBorder }]}
                  onPress={openWhatsApp}
                  activeOpacity={0.75}
                >
                  <View style={[styles.contactOptionIcon, { backgroundColor: '#25D366' }]}>
                    <Ionicons name="logo-whatsapp" size={24} color="#fff" />
                  </View>
                  <View style={styles.contactOptionText}>
                    <Text style={[styles.contactOptionLabel, { color: C.text }]}>WhatsApp</Text>
                    <Text style={[styles.contactOptionSub, { color: C.subText }]}>{waNumber ?? 'Non disponible'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.subText} />
                </TouchableOpacity>

                {/* Appel principal */}
                <TouchableOpacity
                  style={[styles.contactOptionRow, { borderBottomColor: C.cardBorder }]}
                  onPress={() => callNumber ? openCall(callNumber) : Alert.alert('Indisponible', 'Numéro non renseigné.')}
                  activeOpacity={0.75}
                >
                  <View style={[styles.contactOptionIcon, { backgroundColor: C.price }]}>
                    <Ionicons name="call" size={24} color="#fff" />
                  </View>
                  <View style={styles.contactOptionText}>
                    <Text style={[styles.contactOptionLabel, { color: C.text }]}>Appel / SMS</Text>
                    <Text style={[styles.contactOptionSub, { color: C.subText }]}>{callNumber ?? 'Non disponible'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.subText} />
                </TouchableOpacity>

                {/* Appel secondaire (si renseigné) */}
                {phone2 ? (
                  <TouchableOpacity
                    style={[styles.contactOptionRow, { borderBottomColor: C.cardBorder }]}
                    onPress={() => openCall(phone2)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.contactOptionIcon, { backgroundColor: C.price }]}>
                      <Ionicons name="call-outline" size={24} color="#fff" />
                    </View>
                    <View style={styles.contactOptionText}>
                      <Text style={[styles.contactOptionLabel, { color: C.text }]}>Téléphone 2</Text>
                      <Text style={[styles.contactOptionSub, { color: C.subText }]}>{phone2}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={C.subText} />
                  </TouchableOpacity>
                ) : null}

                {/* Chat */}
                <TouchableOpacity
                  style={[styles.contactOptionRow, { borderBottomColor: C.cardBorder }]}
                  onPress={() => {
                    if (!moto.enterprise_id) return;
                    const principalImg =
                      moto.moto_images?.find((i) => i.is_principal) ?? moto.moto_images?.[0];
                    onClose();
                    router.push({
                      pathname: '/chat',
                      params: {
                        enterprise_id: moto.enterprise_id,
                        enterprise_name: moto.enterprises?.name ?? 'Entreprise',
                        moto_name: `${moto.marque} ${moto.modele}`.trim(),
                        moto_price: moto.prix_vente ? String(moto.prix_vente) : '',
                        moto_etat: moto.etat ?? '',
                        moto_image: principalImg?.image_uri ?? '',
                        moto_couleur: moto.couleur ?? '',
                      },
                    } as any);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={[styles.contactOptionIcon, { backgroundColor: C.primary }]}>
                    <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
                  </View>
                  <View style={styles.contactOptionText}>
                    <Text style={[styles.contactOptionLabel, { color: C.text }]}>Chat en temps réel</Text>
                    <Text style={[styles.contactOptionSub, { color: C.subText }]}>Messagerie directe</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.subText} />
                </TouchableOpacity>

                {/* GPS */}
                <TouchableOpacity
                  style={[styles.contactOptionRow, { borderBottomWidth: 0 }]}
                  onPress={openGPS}
                  activeOpacity={0.75}
                >
                  <View style={[styles.contactOptionIcon, { backgroundColor: C.accent }]}>
                    <Ionicons name="navigate" size={24} color="#fff" />
                  </View>
                  <View style={styles.contactOptionText}>
                    <Text style={[styles.contactOptionLabel, { color: C.text }]}>Itinéraire / GPS</Text>
                    <Text style={[styles.contactOptionSub, { color: C.subText }]}>
                      {gpsLoc ? 'Ouvrir dans Maps' : 'Position non renseignée'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.subText} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1 },

  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  feedHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  feedHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoCircle: {
    width: 38, height: 38, borderRadius: 19,
    justifyContent: 'center', alignItems: 'center',
  },
  appName: { fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  appTagline: { fontSize: 11, marginTop: 1 },
  themeBtn: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
  },
  loginBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
  },
  loginBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 14, marginVertical: 10,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14 },

  filtersRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingBottom: 10, gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
    borderWidth: 1,
  },
  filterPillText: { fontSize: 13, fontWeight: '600' },
  resultCount: { marginLeft: 'auto', fontSize: 12 },

  feedList: { paddingBottom: 30, paddingTop: 4 },
  emptyList: { flex: 1 },
  separator: { height: 8 },

  footerLoader: { paddingVertical: 24, alignItems: 'center', gap: 8 },
  footerLoaderText: { fontSize: 12 },
  footerEnd: { textAlign: 'center', fontSize: 12, paddingVertical: 20 },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  loadingText: { fontSize: 14 },

  card: {
    marginHorizontal: 10, borderRadius: 14, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 13, gap: 10 },
  cardHeaderText: { flex: 1 },
  enterpriseName: { fontWeight: '700', fontSize: 14 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  cardTime: { fontSize: 11 },
  etatBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  etatBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  motoImage: { width: '100%', height: width * 0.55 },
  motoImagePlaceholder: {
    width: '100%', height: width * 0.45,
    justifyContent: 'center', alignItems: 'center',
  },
  cardBody: { padding: 13 },
  motoTitle: { fontSize: 17, fontWeight: '700', marginBottom: 7 },
  motoTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  tagText: { fontSize: 12 },
  price: { fontSize: 16, fontWeight: '800' },
  cardActions: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11, gap: 6 },
  actionText: { fontSize: 13, fontWeight: '600' },
  actionDivider: { width: StyleSheet.hairlineWidth, marginVertical: 8 },

  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: '800' },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80, gap: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },

  pinContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  pinCard: {
    width: '100%', borderRadius: 22, padding: 30, alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  pinTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  pinSubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 24 },
  pinInput: {
    width: '100%', borderWidth: 1.5, borderRadius: 14, padding: 15,
    textAlign: 'center', letterSpacing: 14, fontSize: 26, marginBottom: 18,
  },
  pinSubmitBtn: { width: '100%', padding: 15, borderRadius: 14, alignItems: 'center' },
  pinSubmitText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Détail moto
  detailSafeArea: { flex: 1 },
  detailHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: 10,
  },
  detailCloseBtn: { padding: 4 },
  detailHeaderTitle: { flex: 1, fontSize: 16, fontWeight: '700' },
  detailContactBtn: { padding: 4 },
  detailFullImage: { width, height: width * 0.75 },
  detailNoImgBox: { height: width * 0.6, justifyContent: 'center', alignItems: 'center' },
  swipeHint: { textAlign: 'center', fontSize: 11, marginTop: 6, fontStyle: 'italic' },
  detailPriceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  detailPrice: { fontSize: 22, fontWeight: '800' },
  detailEtatBadge: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  detailEtatText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  detailEnterpriseRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  detailEnterpriseLabel: { flex: 1, fontWeight: '700', fontSize: 14 },
  detailTimeLabel: { fontSize: 12 },
  detailSection: { paddingHorizontal: 16, paddingTop: 16 },
  detailSectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  detailDescText: { fontSize: 14, lineHeight: 22 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11 },
  detailLabel: { fontSize: 14 },
  detailValue: { fontSize: 14, fontWeight: '600', textAlign: 'right', flex: 1, marginLeft: 12 },
  detailBottomBar: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  detailContactBtnFull: { borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  detailContactBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Contact modal
  contactOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  contactSheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden' },
  contactSheetHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: 10,
  },
  contactSheetDrag: { position: 'absolute', top: 8, left: '50%', marginLeft: -20, width: 40, height: 4, borderRadius: 2 },
  contactSheetTitle: { flex: 1, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  contactSheetClose: { padding: 4 },
  contactOptionsList: { paddingHorizontal: 16, paddingVertical: 8, paddingBottom: 32 },
  contactOptionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  contactOptionIcon: { width: 46, height: 46, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  contactOptionText: { flex: 1 },
  contactOptionLabel: { fontSize: 15, fontWeight: '600' },
  contactOptionSub: { fontSize: 12, marginTop: 2 },

});
