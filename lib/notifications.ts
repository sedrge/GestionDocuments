// lib/notifications.ts
//
// Centralise la gestion des notifications applicatives + push locaux :
// - Demande de permission
// - Création de notifications en base (table `notifications`)
// - Déclenchement immédiat d'un push local
// - Programmation des rappels J-3 / J-2 / Jour-J pour un rendez-vous
// - Annulation des rappels d'un rendez-vous (utile en cas de modif/suppression)

import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "./supabase";

// expo-notifications crash dans Expo Go depuis SDK 53 → chargement dynamique
const isExpoGo = Constants.appOwnership === "expo";
let Notifications: typeof import("expo-notifications") | null = null;

if (!isExpoGo) {
  try {
    Notifications = require("expo-notifications");
    Notifications!.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch {
    Notifications = null;
  }
}

export type NotifType =
  | "rdv_modification"
  | "rdv_rappel_j3"
  | "rdv_rappel_j2"
  | "rdv_rappel_j0";

export type RendezVousLite = {
  id: string;
  user_id?: string;
  date_rdv: string | null;   // YYYY-MM-DD
  heure_rdv: string | null;  // HH:MM
  lieu: string | null;
  nom_prenom: string | null;
  telephone: string | null;
  motif: string | null;
  description: string | null;
};

// ---------------------------------------------------------------------------
// PERMISSIONS
// ---------------------------------------------------------------------------

export async function ensureNotificationPermissions(): Promise<boolean> {
  if (!Notifications) return false;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Notifications",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#5856D6",
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

// ---------------------------------------------------------------------------
// PUSH LOCAUX
// ---------------------------------------------------------------------------

async function fireLocalPushNow(titre: string, message: string, data: any = {}) {
  if (!Notifications) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title: titre, body: message, data, sound: true },
      trigger: null,
    });
  } catch {
    // L'enregistrement DB suffit comme repli.
  }
}

async function scheduleLocalPushAt(
  titre: string,
  message: string,
  date: Date,
  data: any = {},
): Promise<string | null> {
  if (!Notifications) return null;
  try {
    if (date.getTime() <= Date.now()) return null;
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: titre, body: message, data, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
    return id;
  } catch {
    return null;
  }
}

async function cancelLocalPush(pushId: string | null | undefined) {
  if (!Notifications || !pushId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(pushId);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// FORMATAGE DU MESSAGE D'UN RDV
// ---------------------------------------------------------------------------

function formatDateFR(iso: string | null): string {
  if (!iso) return "—";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function rdvSummary(r: RendezVousLite): string {
  const parts: string[] = [];
  if (r.nom_prenom) parts.push(`Client : ${r.nom_prenom}`);
  if (r.motif) parts.push(`Motif : ${r.motif}`);
  if (r.date_rdv) parts.push(`Date : ${formatDateFR(r.date_rdv)}`);
  if (r.heure_rdv) parts.push(`Heure : ${r.heure_rdv}`);
  if (r.lieu) parts.push(`Lieu : ${r.lieu}`);
  return parts.join(" • ");
}

// ---------------------------------------------------------------------------
// INSERTION EN BASE
// ---------------------------------------------------------------------------

async function insertNotification(row: {
  user_id: string;
  type: NotifType;
  titre: string;
  message: string;
  rendezvous_id?: string | null;
  data?: any;
  statut?: "pending" | "sent" | "cancelled";
  scheduled_at?: string | null;
  push_id?: string | null;
}) {
  const { data, error } = await supabase
    .from("notifications")
    .insert([
      {
        user_id: row.user_id,
        type: row.type,
        titre: row.titre,
        message: row.message,
        rendezvous_id: row.rendezvous_id ?? null,
        data: row.data ?? null,
        statut: row.statut ?? "sent",
        scheduled_at: row.scheduled_at ?? null,
        push_id: row.push_id ?? null,
        updated_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();
  if (error) {
    // On ne casse pas le flux principal en cas d'erreur
    console.warn("[notifications] insert error", error.message);
    return null;
  }
  return data;
}

// ---------------------------------------------------------------------------
// API HAUTE-NIVEAU
// ---------------------------------------------------------------------------

/**
 * Crée une notification de modification d'un rendez-vous.
 * `changedFields` liste les champs modifiés (libellés lisibles).
 */
export async function notifyRdvModification(
  userId: string,
  rdv: RendezVousLite,
  changedFields: string[],
) {
  await ensureNotificationPermissions();

  const champs =
    changedFields.length > 0
      ? changedFields.join(", ")
      : "un champ";

  const titre = "Rendez-vous modifié";
  const message = `Modification (${champs}) — ${rdvSummary(rdv)}`;

  await fireLocalPushNow(titre, message, {
    type: "rdv_modification",
    rendezvous_id: rdv.id,
  });

  await insertNotification({
    user_id: userId,
    type: "rdv_modification",
    titre,
    message,
    rendezvous_id: rdv.id,
    data: { changed: changedFields, rdv },
    statut: "sent",
  });
}

/**
 * Programme les rappels J-3, J-2 et Jour-J pour un rendez-vous.
 * Avant de programmer, annule les rappels en attente déjà associés à ce RDV.
 */
export async function scheduleRdvReminders(
  userId: string,
  rdv: RendezVousLite,
) {
  await ensureNotificationPermissions();

  // 1) Annuler les rappels en attente précédents
  await cancelRdvReminders(rdv.id);

  if (!rdv.date_rdv) return;

  // 2) Calcul de la date cible — par défaut 09:00 le jour J
  const [y, m, d] = rdv.date_rdv.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return;

  const buildReminderDate = (offsetDays: number): Date => {
    const base = new Date(y, m - 1, d, 9, 0, 0, 0); // 09:00 locale
    base.setDate(base.getDate() - offsetDays);
    return base;
  };

  // Le jour-J on tente l'heure du RDV - 1h ; sinon 09:00
  const buildJourJDate = (): Date => {
    if (rdv.heure_rdv && /^\d{1,2}:\d{2}$/.test(rdv.heure_rdv)) {
      const [hh, mm] = rdv.heure_rdv.split(":").map((n) => parseInt(n, 10));
      const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
      dt.setHours(dt.getHours() - 1); // 1h avant
      return dt;
    }
    return new Date(y, m - 1, d, 9, 0, 0, 0);
  };

  const summary = rdvSummary(rdv);

  const plan: { type: NotifType; date: Date; titre: string }[] = [
    {
      type: "rdv_rappel_j3",
      date: buildReminderDate(3),
      titre: "Rappel : rendez-vous dans 3 jours",
    },
    {
      type: "rdv_rappel_j2",
      date: buildReminderDate(2),
      titre: "Rappel : rendez-vous dans 2 jours",
    },
    {
      type: "rdv_rappel_j0",
      date: buildJourJDate(),
      titre: "Rappel : rendez-vous aujourd'hui",
    },
  ];

  for (const p of plan) {
    if (p.date.getTime() <= Date.now()) continue; // déjà passé : on saute

    const pushId = await scheduleLocalPushAt(p.titre, summary, p.date, {
      type: p.type,
      rendezvous_id: rdv.id,
    });

    await insertNotification({
      user_id: userId,
      type: p.type,
      titre: p.titre,
      message: summary,
      rendezvous_id: rdv.id,
      data: { rdv },
      statut: "pending",
      scheduled_at: p.date.toISOString(),
      push_id: pushId,
    });
  }
}

/**
 * Annule (côté push + côté DB) tous les rappels en attente pour un RDV.
 */
export async function cancelRdvReminders(rendezvousId: string) {
  const { data } = await supabase
    .from("notifications")
    .select("id, push_id")
    .eq("rendezvous_id", rendezvousId)
    .eq("statut", "pending");

  if (data && data.length > 0) {
    for (const row of data) {
      await cancelLocalPush(row.push_id);
    }
    await supabase
      .from("notifications")
      .update({ statut: "cancelled", updated_at: new Date().toISOString() })
      .in(
        "id",
        data.map((d: any) => d.id),
      );
  }
}

/**
 * Renvoie le nombre de notifications non lues pour l'utilisateur courant.
 */
export async function countUnreadNotifications(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("lu", false);
  if (error) return 0;
  return count ?? 0;
}

/**
 * Compare deux états d'un RDV et renvoie la liste des champs lisibles modifiés.
 */
export function diffRdvFields(
  before: RendezVousLite,
  after: RendezVousLite,
): string[] {
  const map: { key: keyof RendezVousLite; label: string }[] = [
    { key: "date_rdv", label: "date" },
    { key: "heure_rdv", label: "heure" },
    { key: "lieu", label: "lieu" },
    { key: "nom_prenom", label: "nom & prénom" },
    { key: "telephone", label: "téléphone" },
    { key: "motif", label: "motif" },
    { key: "description", label: "description" },
  ];
  const changed: string[] = [];
  for (const { key, label } of map) {
    if ((before[key] || "") !== (after[key] || "")) {
      changed.push(label);
    }
  }
  return changed;
}
