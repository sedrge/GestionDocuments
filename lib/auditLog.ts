import { supabase } from './supabase';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'UPLOAD'
  | 'DOWNLOAD'
  | 'LOGIN'
  | 'LOGOUT'
  | 'APPROVE'
  | 'DEACTIVATE';

export type EntityType =
  | 'document'
  | 'categorie'
  | 'moto'
  | 'vente'
  | 'rendezvous'
  | 'registre'
  | 'decharge'
  | 'recu'
  | 'user'
  | 'session';

interface LogParams {
  enterprise_id: string;
  action: AuditAction;
  entity_type: EntityType;
  entity_id?: string;
  entity_name?: string;
  details?: Record<string, any>;
}

export async function logAction(params: LogParams): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const user_name =
      (user.user_metadata?.full_name as string | undefined) ||
      user.email ||
      'Inconnu';

    await supabase.from('audit_logs').insert({
      enterprise_id: params.enterprise_id,
      user_id: user.id,
      user_name,
      action: params.action,
      entity_type: params.entity_type,
      entity_id: params.entity_id ?? null,
      entity_name: params.entity_name ?? null,
      details: params.details ?? null,
    });
  } catch {
    // Le logging ne doit jamais interrompre l'application
  }
}

export const ACTION_LABELS: Record<AuditAction, string> = {
  CREATE:     'a créé',
  UPDATE:     'a modifié',
  DELETE:     'a supprimé',
  UPLOAD:     'a importé',
  DOWNLOAD:   'a téléchargé',
  LOGIN:      's\'est connecté',
  LOGOUT:     's\'est déconnecté',
  APPROVE:    'a approuvé',
  DEACTIVATE: 'a désactivé',
};

export const ENTITY_LABELS: Record<EntityType, string> = {
  document:   'le document',
  categorie:  'le dossier',
  moto:       'la moto',
  vente:      'la vente',
  rendezvous: 'le rendez-vous',
  registre:   'le registre',
  decharge:   'la décharge',
  recu:       'le reçu',
  user:       'l\'utilisateur',
  session:    '',
};

export const ACTION_COLORS: Record<AuditAction, string> = {
  CREATE:     '#34C759',
  UPDATE:     '#007AFF',
  DELETE:     '#FF3B30',
  UPLOAD:     '#5856D6',
  DOWNLOAD:   '#0A84FF',
  LOGIN:      '#32D74B',
  LOGOUT:     '#FF9500',
  APPROVE:    '#34C759',
  DEACTIVATE: '#FF3B30',
};
