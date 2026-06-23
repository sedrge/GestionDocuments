import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const DRAWER_WIDTH_RATIO = 0.78;

interface HamburgerMenuProps {
  children?: React.ReactNode;
  headerTitle?: string;
  unreadNotif?: number;
  isSuper?: boolean;
  isEnterpriseAdmin?: boolean;
  isDark?: boolean;
  onToggleTheme?: () => void;
  onLogout?: () => void;
  onOpenNewFolderModal?: () => void;
  onPickDocument?: () => void;
  onCapturePhoto?: () => void;
  onCaptureVideo?: () => void;
  viewMode?: "list" | "details" | "grid";
  onSetViewMode?: (mode: "list" | "details" | "grid") => void;
  onChangePin?: () => void;
  onChangeLogo?: () => void;
  /** Clés de menu autorisées. undefined = tout visible (admins). */
  permittedKeys?: Set<string>;
}

type MenuItem = {
  key: string;
  icon: string;
  label: string;
  route?: string;
  action?: () => void;
};

type MenuSection = {
  id: string;
  label: string;
  icon: string;
  items: MenuItem[];
};

export const HamburgerMenu = ({
  children,
  headerTitle = "Menu",
  unreadNotif = 0,
  isSuper = false,
  isEnterpriseAdmin = false,
  isDark = true,
  onToggleTheme,
  onLogout,
  onOpenNewFolderModal,
  onPickDocument,
  onCapturePhoto,
  onCaptureVideo,
  viewMode = "list",
  onSetViewMode,
  onChangePin,
  onChangeLogo,
  permittedKeys,
}: HamburgerMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const drawerAnimation = React.useRef(new Animated.Value(0)).current;
  const router = useRouter();
  const { width: screenWidth } = Dimensions.get("window");
  const drawerWidth = screenWidth * DRAWER_WIDTH_RATIO;

  const colors = {
    light: {
      bg: "#F5F5F7",
      card: "#FFFFFF",
      text: "#1C1C1E",
      subText: "#8E8E93",
      primary: "#007AFF",
      nav: "#E5E5EA",
      border: "#D1D1D6",
    },
    dark: {
      bg: "#121212",
      card: "#1E1E1E",
      text: "#FFFFFF",
      subText: "#A1A1A1",
      primary: "#0A84FF",
      nav: "#2C2C2E",
      border: "#38383A",
    },
  };

  const t = isDark ? colors.dark : colors.light;

  const toggleMenu = () => {
    const opening = !isOpen;
    setIsOpen(opening);
    Animated.timing(drawerAnimation, {
      toValue: opening ? 1 : 0,
      duration: 280,
      useNativeDriver: false,
    }).start(() => {
      if (!opening) setActiveSubmenu(null);
    });
  };

  const closeMenu = () => {
    setIsOpen(false);
    Animated.timing(drawerAnimation, {
      toValue: 0,
      duration: 280,
      useNativeDriver: false,
    }).start(() => setActiveSubmenu(null));
  };

  const drawerTranslate = drawerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-drawerWidth, 0],
  });

  const backdropOpacity = drawerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.55],
  });

  const handleNavigation = (route: string) => {
    closeMenu();
    setTimeout(() => router.push(route as any), 10);
  };

  const handleAction = (action?: () => void) => {
    closeMenu();
    setTimeout(() => action?.(), 10);
  };

  // ── Structure du menu avec clés ────────────────────────────────────────────
  const buildMenuStructure = (): MenuSection[] => [
    {
      id: "fichier",
      label: "Fichier",
      icon: "folder-outline",
      items: [
        { key: "fichier.nouveau_dossier",  icon: "folder-outline",          label: "Nouveau Dossier",  action: onOpenNewFolderModal },
        { key: "fichier.importer_fichier", icon: "document-attach-outline", label: "Importer Fichier", action: onPickDocument },
        { key: "fichier.prendre_photo",    icon: "camera-outline",          label: "Prendre Photo",    action: onCapturePhoto },
        { key: "fichier.filmer_video",     icon: "videocam-outline",        label: "Filmer Vidéo",     action: onCaptureVideo },
        { key: "fichier.registre",         icon: "clipboard-outline",       label: "Registre",         route: "/annees_mois" },
        { key: "fichier.decharge",         icon: "document-text-outline",   label: "Décharge",         route: "/annees_mois_decharge" },
      ],
    },
    {
      id: "gestion",
      label: "Gestion",
      icon: "settings-outline",
      items: [
        { key: "gestion.moto",        icon: "bicycle-outline",   label: "Moto",        route: "/motos" },
        { key: "gestion.catalogue",   icon: "albums-outline",    label: "Catalogue",   route: "/catalogue" },
        { key: "gestion.vente",       icon: "bag-check-outline", label: "Vente",       route: "/vente" },
        { key: "gestion.recu",        icon: "receipt-outline",   label: "Réçu",        route: "/annees_mois_recu" },
        { key: "gestion.rendez_vous", icon: "calendar-outline",  label: "Rendez-Vous", route: "/rendezvous" },
      ],
    },
    {
      id: "parametres",
      label: "Paramètres",
      icon: "cog-outline",
      items: [
        { key: "parametres.logo",   icon: "image-outline",    label: "Changer le Logo", action: onChangeLogo },
        { key: "parametres.entete", icon: "business-outline", label: "Entête facture",  route: "/parametres_entreprise" },
        { key: "parametres.pin",    icon: "keypad-outline",   label: "Changer le PIN",  action: onChangePin },
      ],
    },
    {
      id: "affichage",
      label: "Affichage",
      icon: "eye-outline",
      items: [
        { key: "affichage.list",    icon: viewMode === "list"    ? "checkmark-circle" : "ellipse-outline", label: "LIST",    action: () => onSetViewMode?.("list") },
        { key: "affichage.details", icon: viewMode === "details" ? "checkmark-circle" : "ellipse-outline", label: "DETAILS", action: () => onSetViewMode?.("details") },
        { key: "affichage.grid",    icon: viewMode === "grid"    ? "checkmark-circle" : "ellipse-outline", label: "GRID",    action: () => onSetViewMode?.("grid") },
      ],
    },
  ];

  // Filtre les sections et items selon les permissions
  const filterSection = (section: MenuSection): MenuSection | null => {
    // Les admins (permittedKeys === undefined) voient tout
    if (permittedKeys === undefined) return section;
    const visibleItems = section.items.filter((item) => permittedKeys.has(item.key));
    if (visibleItems.length === 0) return null;
    return { ...section, items: visibleItems };
  };

  const menuStructure = buildMenuStructure()
    .map(filterSection)
    .filter((s): s is MenuSection => s !== null);

  const SubMenuItem = ({ item }: { item: MenuItem }) => (
    <TouchableOpacity
      style={[styles.subMenuItem, { borderBottomColor: t.border }]}
      onPress={() => {
        if (item.route) handleNavigation(item.route);
        else if (item.action) handleAction(item.action);
      }}
      activeOpacity={0.7}
    >
      <Ionicons name={item.icon as any} size={15} color={t.subText} />
      <Text style={[styles.subMenuLabel, { color: t.text }]}>{item.label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* En-tête avec bouton hamburger */}
      <View style={[styles.header, { backgroundColor: t.card, borderBottomColor: t.border }]}>
        <TouchableOpacity
          style={styles.hamburgerButton}
          onPress={toggleMenu}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Animated.View
            style={[
              styles.hamburgerLine,
              {
                backgroundColor: t.text,
                transform: [
                  { rotate: drawerAnimation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "45deg"] }) },
                  { translateY: drawerAnimation.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.hamburgerLine,
              {
                backgroundColor: t.text,
                opacity: drawerAnimation.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
              },
            ]}
          />
          <Animated.View
            style={[
              styles.hamburgerLine,
              {
                backgroundColor: t.text,
                transform: [
                  { rotate: drawerAnimation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-45deg"] }) },
                  { translateY: drawerAnimation.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) },
                ],
              },
            ]}
          />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: t.text }]} numberOfLines={1}>
          {headerTitle}
        </Text>

        {/* Badge notifications dans l'en-tête */}
        <TouchableOpacity
          style={styles.headerRight}
          onPress={() => handleNavigation("/notifications")}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications-outline" size={22} color={t.text} />
          {unreadNotif > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{unreadNotif > 99 ? "99+" : unreadNotif}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Zone de contenu principal */}
      <View style={[styles.contentContainer, { backgroundColor: t.bg }]}>
        {children}
      </View>

      {/* Fond assombri */}
      {isOpen && (
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={closeMenu}
          />
        </Animated.View>
      )}

      {/* Drawer latéral */}
      <Animated.View
        style={[
          styles.drawer,
          { width: drawerWidth, transform: [{ translateX: drawerTranslate }], backgroundColor: t.card },
        ]}
        pointerEvents={isOpen ? "auto" : "none"}
      >
        {/* En-tête du drawer */}
        <View style={[styles.drawerHeader, { borderBottomColor: t.border, backgroundColor: t.nav }]}>
          <Ionicons name="menu" size={22} color={t.primary} />
          <Text style={[styles.drawerHeaderTitle, { color: t.text }]}>Navigation</Text>
          <TouchableOpacity onPress={closeMenu} style={styles.drawerCloseBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={22} color={t.subText} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.menuContent} showsVerticalScrollIndicator={false}>
          {/* Menus déroulants */}
          {menuStructure.map((menu) => (
            <View key={menu.id}>
              <TouchableOpacity
                style={[
                  styles.mainMenuItem,
                  {
                    backgroundColor: activeSubmenu === menu.id ? t.nav : "transparent",
                    borderBottomColor: t.border,
                  },
                ]}
                onPress={() => setActiveSubmenu(activeSubmenu === menu.id ? null : menu.id)}
                activeOpacity={0.7}
              >
                <Ionicons name={menu.icon as any} size={20} color={activeSubmenu === menu.id ? t.primary : t.text} />
                <Text
                  style={[
                    styles.mainMenuLabel,
                    { color: activeSubmenu === menu.id ? t.primary : t.text },
                  ]}
                >
                  {menu.label}
                </Text>
                <Ionicons
                  name={activeSubmenu === menu.id ? "chevron-up" : "chevron-down"}
                  size={15}
                  color={t.subText}
                  style={{ marginLeft: "auto" }}
                />
              </TouchableOpacity>

              {activeSubmenu === menu.id && (
                <View style={{ backgroundColor: t.bg }}>
                  {menu.items.map((item) => (
                    <SubMenuItem key={item.key} item={item} />
                  ))}
                </View>
              )}
            </View>
          ))}

          {/* Séparateur */}
          <View style={[styles.separator, { backgroundColor: t.border }]} />

          {/* Dashboard Admin (admin entreprise) */}
          {isEnterpriseAdmin && (
            <>
              <View style={[styles.adminSectionHeader, { backgroundColor: t.nav }]}>
                <Ionicons name="shield-outline" size={14} color={t.primary} />
                <Text style={[styles.adminSectionLabel, { color: t.primary }]}>Administration</Text>
              </View>
              <TouchableOpacity
                style={[styles.mainMenuItem, { borderBottomColor: t.border }]}
                onPress={() => handleNavigation("/admin/dashboard")}
                activeOpacity={0.7}
              >
                <Ionicons name="grid-outline" size={20} color={t.text} />
                <Text style={[styles.mainMenuLabel, { color: t.text }]}>Tableau de bord</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.mainMenuItem, { borderBottomColor: t.border }]}
                onPress={() => handleNavigation("/admin/stock")}
                activeOpacity={0.7}
              >
                <Ionicons name="layers-outline" size={20} color={t.text} />
                <Text style={[styles.mainMenuLabel, { color: t.text }]}>Gestion du stock</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.mainMenuItem, { borderBottomColor: t.border }]}
                onPress={() => handleNavigation("/admin/ventes")}
                activeOpacity={0.7}
              >
                <Ionicons name="bag-check-outline" size={20} color={t.text} />
                <Text style={[styles.mainMenuLabel, { color: t.text }]}>Historique ventes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.mainMenuItem, { borderBottomColor: t.border }]}
                onPress={() => handleNavigation("/admin/rapports")}
                activeOpacity={0.7}
              >
                <Ionicons name="document-text-outline" size={20} color={t.text} />
                <Text style={[styles.mainMenuLabel, { color: t.text }]}>Rapports & Export</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.mainMenuItem, { borderBottomColor: t.border }]}
                onPress={() => handleNavigation("/admin/users")}
                activeOpacity={0.7}
              >
                <Ionicons name="people-outline" size={20} color={t.text} />
                <Text style={[styles.mainMenuLabel, { color: t.text }]}>Équipe / Utilisateurs</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.mainMenuItem, { borderBottomColor: t.border }]}
                onPress={() => handleNavigation("/admin/audit")}
                activeOpacity={0.7}
              >
                <Ionicons name="time-outline" size={20} color={t.text} />
                <Text style={[styles.mainMenuLabel, { color: t.text }]}>Journal d'activité</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.mainMenuItem, { borderBottomColor: t.border }]}
                onPress={() => handleNavigation("/admin/contact")}
                activeOpacity={0.7}
              >
                <Ionicons name="call-outline" size={20} color={t.text} />
                <Text style={[styles.mainMenuLabel, { color: t.text }]}>Page de contact</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.mainMenuItem, { borderBottomColor: t.border }]}
                onPress={() => handleNavigation("/admin/chat")}
                activeOpacity={0.7}
              >
                <Ionicons name="chatbubbles-outline" size={20} color={t.text} />
                <Text style={[styles.mainMenuLabel, { color: t.text }]}>Messages clients</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Super Admin */}
          {isSuper && (
            <TouchableOpacity
              style={[styles.mainMenuItem, { borderBottomColor: t.border }]}
              onPress={() => handleNavigation("/admin/enterprises")}
              activeOpacity={0.7}
            >
              <Ionicons name="business-outline" size={20} color={t.text} />
              <Text style={[styles.mainMenuLabel, { color: t.text }]}>🏢 Administration</Text>
            </TouchableOpacity>
          )}

          {/* Thème */}
          <TouchableOpacity
            style={[styles.mainMenuItem, { borderBottomColor: t.border }]}
            onPress={() => { onToggleTheme?.(); }}
            activeOpacity={0.7}
          >
            <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={20} color={t.text} />
            <Text style={[styles.mainMenuLabel, { color: t.text }]}>
              {isDark ? "Mode Clair" : "Mode Sombre"}
            </Text>
          </TouchableOpacity>

          {/* Déconnexion */}
          <TouchableOpacity
            style={[styles.mainMenuItem, { borderBottomColor: t.border }]}
            onPress={() => handleAction(onLogout)}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
            <Text style={[styles.mainMenuLabel, { color: "#FF3B30" }]}>Déconnexion</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  hamburgerButton: {
    width: 38,
    height: 38,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  hamburgerLine: { width: 22, height: 2.5, borderRadius: 2 },
  headerTitle: { fontSize: 17, fontWeight: "700", marginLeft: 10, flex: 1 },
  headerRight: { position: "relative", padding: 4 },
  headerBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  headerBadgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  contentContainer: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    zIndex: 9,
  },
  drawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 3, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  drawerHeaderTitle: { fontSize: 15, fontWeight: "700", marginLeft: 10, flex: 1 },
  drawerCloseBtn: { padding: 4 },
  menuContent: { paddingVertical: 6 },
  mainMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mainMenuLabel: { fontSize: 15, fontWeight: "600", marginLeft: 12 },
  subMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 44,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  subMenuLabel: { fontSize: 14, marginLeft: 10 },
  separator: { height: StyleSheet.hairlineWidth, marginVertical: 8, marginHorizontal: 20 },
  adminSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 6,
  },
  adminSectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
});
