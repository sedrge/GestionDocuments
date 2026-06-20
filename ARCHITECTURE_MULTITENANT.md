# Architecture Multi-Tenant - DocVault

## 1. STRUCTURE DES TABLES SUPABASE

### 1.1 Table `enterprises` (Entreprises)

```sql
CREATE TABLE enterprises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(20) NOT NULL UNIQUE,  -- Code unique généré auto (ex: XXXXXX)
  logo_url VARCHAR(500),              -- URL du logo
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT FALSE,    -- Doit être activée par super-admin
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

### 1.2 Table `enterprise_admins` (Admins d'Entreprise)

```sql
CREATE TABLE enterprise_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  user_id UUID REFERENCES auth.users(id),  -- NULL tant que pas de compte activé
  is_active BOOLEAN DEFAULT TRUE,
  role VARCHAR(50) DEFAULT 'enterprise_admin',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(enterprise_id, email)  -- Un seul admin par email par entreprise
);
```

### 1.3 Table `enterprise_users` (Users d'Entreprise)

```sql
CREATE TABLE enterprise_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'user',  -- 'user', 'admin', etc.
  is_active BOOLEAN DEFAULT FALSE,  -- Admin doit activer le user
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(enterprise_id, user_id)  -- Un user une fois par entreprise
);
```

### 1.4 Table `super_admins` (Super-Admins)

```sql
CREATE TABLE super_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT now()
);
```

### 1.5 Modifier table `documents` existante

```sql
ALTER TABLE documents ADD COLUMN enterprise_id UUID REFERENCES enterprises(id) ON DELETE CASCADE;
ALTER TABLE documents ADD COLUMN created_by UUID REFERENCES auth.users(id);
-- Ajouter RLS (Row Level Security)
```

### 1.6 Modifier table `categories` existante

```sql
ALTER TABLE categories ADD COLUMN enterprise_id UUID REFERENCES enterprises(id) ON DELETE CASCADE;
-- Ajouter RLS
```

---

## 2. ROW LEVEL SECURITY (RLS)

### Politiques pour `enterprises`

```sql
-- Super-admin peut voir toutes les entreprises
CREATE POLICY "super_admin_see_all" ON enterprises
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM super_admins WHERE super_admins.user_id = auth.uid())
  );

-- User ne peut voir que sa propre entreprise
CREATE POLICY "user_see_own_enterprise" ON enterprises
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM enterprise_users WHERE enterprise_id = enterprises.id
    )
    OR
    auth.uid() IN (
      SELECT created_by FROM enterprises WHERE enterprises.id = enterprises.id
    )
  );
```

### Politiques pour `documents`

```sql
-- Super-admin peut voir tout
CREATE POLICY "super_admin_see_all_docs" ON documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM super_admins WHERE super_admins.user_id = auth.uid())
  );

-- User ne voit que les docs de son entreprise
CREATE POLICY "user_see_own_enterprise_docs" ON documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM enterprise_users
      WHERE enterprise_users.user_id = auth.uid()
        AND enterprise_users.enterprise_id = documents.enterprise_id
        AND enterprise_users.is_active = TRUE
    )
  );
```

---

## 3. FLUX DE CONNEXION/INSCRIPTION

### Phase 1: Écran d'Accueil

```
┌─────────────────────────────┐
│  DocVault Multi-Tenant      │
├─────────────────────────────┤
│  1. Se connecter            │
│  2. Créer une entreprise    │
│  3. Rejoindre une entreprise│
└─────────────────────────────┘
```

### Phase 2a: Créer une Entreprise

```
Formulaire:
  - Nom entreprise
  - Logo (upload)
  - Téléphone entreprise
  - Nom complet admin
  - Email admin
  - Téléphone admin
  - Mot de passe admin
  - Confirmation mot de passe

Après:
  1. Créer compte auth Supabase pour l'admin
  2. Insérer dans `enterprises` (is_active = FALSE)
  3. Insérer dans `enterprise_admins`
  4. Générer code unique (ex: ENT-ABC123DEF)
  5. Afficher code à l'admin
  6. Afficher message: "En attente d'activation par le super-admin"
```

### Phase 2b: Rejoindre une Entreprise

```
Formulaire:
  - Code d'entreprise
  - Email
  - Téléphone
  - Nom complet
  - Mot de passe
  - Confirmation mot de passe

Après:
  1. Vérifier que le code existe
  2. Créer compte auth
  3. Insérer dans `enterprise_users` (is_active = FALSE)
  4. Afficher message: "En attente d'activation par l'admin"
```

### Phase 3: Connexion

```
Écran de Login:
  - Email
  - Mot de passe

Après authentification:
  1. Récupérer l'entreprise de l'user
  2. Vérifier is_active (enterprise ET user)
  3. Si activé → accès complet
  4. Si pas activé → page d'attente
  5. Super-admin → voir toutes les entreprises
```

---

## 4. PAGE SUPER-ADMIN: Gestion des Entreprises

### Onglet: Entreprises en Attente

```
┌──────────────────────────────────────┐
│ Entreprises à Activer                │
├──────────────────────────────────────┤
│ 1. TechCorp                          │
│    Créée le: 2024-06-09              │
│    Admin: Jean Dupont                │
│    Email: jean@techcorp.com          │
│    Code: ENT-XYZ789                  │
│    [Activer] [Refuser]               │
│                                      │
│ 2. AutoMotos                         │
│    [Activer] [Refuser]               │
└──────────────────────────────────────┘
```

### Onglet: Entreprises Actives

```
┌──────────────────────────────────────┐
│ Entreprises Actives                  │
├──────────────────────────────────────┤
│ 1. TechCorp (ENT-XYZ789) ✓          │
│    [Voir les données] [Désactiver]   │
│                                      │
│ 2. AutoMotos (ENT-ABC123) ✓         │
│    [Voir les données] [Désactiver]   │
└──────────────────────────────────────┘
```

---

## 5. PAGE ADMIN D'ENTREPRISE: Gestion des Users

### Onglet: Users en Attente

```
┌──────────────────────────────────────┐
│ Utilisateurs à Approuver             │
├──────────────────────────────────────┤
│ 1. Marc Lefevre                      │
│    Email: marc@example.com           │
│    Inscrit le: 2024-06-09            │
│    [Accepter] [Refuser]              │
│                                      │
│ 2. Sophie Bernard                    │
│    [Accepter] [Refuser]              │
└──────────────────────────────────────┘
```

### Onglet: Users Actifs

```
┌──────────────────────────────────────┐
│ Utilisateurs Actifs                  │
├──────────────────────────────────────┤
│ 1. Marc Lefevre ✓                    │
│    Email: marc@example.com           │
│    Rôle: User                        │
│    [Désactiver]                      │
│                                      │
│ 2. Sophie Bernard ✓                  │
│    [Désactiver]                      │
└──────────────────────────────────────┘
```

---

## 6. CONTEXTE TENANT & FILTRAGE DES DONNÉES

### Context React (TenantContext)

```typescript
interface Tenant {
  enterprise_id: string;
  enterprise_name: string;
  user_id: string;
  role: "super_admin" | "enterprise_admin" | "user";
  is_active: boolean;
  code: string;
}

export const TenantContext = createContext<Tenant | null>(null);
```

### Hook `useTenant()`

```typescript
export function useTenant() {
  const tenant = useContext(TenantContext);
  if (!tenant) throw new Error("useTenant must be used inside TenantProvider");
  return tenant;
}
```

### Filtrer les données

```typescript
// Pour les documents
const { data } = await supabase
  .from("documents")
  .select("*")
  .eq("enterprise_id", tenant.enterprise_id)
  .order("created_at", { ascending: false });

// Super-admin voit tous
const { data } = await supabase
  .from("enterprises")
  .select("*")
  .order("created_at", { ascending: false });
```

---

## 7. CODE UNIQUE GÉNÉRÉ

### Format: `ENT-XXXXXX` (où X = alphanumériques aléatoires)

```typescript
function generateEnterpriseCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "ENT-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
```

---

## 8. FLUX D'ACTIVATION

### Super-Admin Activate Enterprise:

```
1. Super-admin voit liste des entreprises en attente
2. Clique sur "Activer"
3. Update enterprises SET is_active = TRUE
4. Notification à l'admin: "Votre entreprise a été activée"
5. Admin peut maintenant accéder à son dashboard
```

### Admin Activate User:

```
1. Admin voit liste des users en attente
2. Clique sur "Accepter"
3. Update enterprise_users SET is_active = TRUE
4. Notification au user: "Vous avez été accepté"
5. User peut accéder aux données de l'entreprise
```

---

## 9. FICHIERS À CRÉER/MODIFIER

### Fichiers Supabase:

- [ ] Migration SQL pour les 5 tables
- [ ] RLS policies

### Fichiers React:

- [ ] `lib/multitenant.ts` - Logique tenant
- [ ] `context/TenantContext.tsx` - Context provider
- [ ] `app/onboarding/create-enterprise.tsx` - Créer entreprise
- [ ] `app/onboarding/join-enterprise.tsx` - Rejoindre entreprise
- [ ] `app/onboarding/index.tsx` - Écran d'accueil
- [ ] `app/admin/enterprises.tsx` - Super-admin gère entreprises
- [ ] `app/admin/users.tsx` - Admin gère users
- [ ] Modifier `app/_layout.tsx` avec TenantProvider

---

## 10. ORDRE D'IMPLÉMENTATION

1. ✅ Créer les 5 tables Supabase + RLS
2. ✅ Créer Context Tenant + hooks
3. ✅ Créer écran "Créer Entreprise"
4. ✅ Créer écran "Rejoindre Entreprise"
5. ✅ Modifier authentification pour charge le tenant
6. ✅ Créer page Super-Admin
7. ✅ Créer page Admin d'Entreprise
8. ✅ Filtrer les données partout avec RLS

---

**Prêt à commencer ? Par quel fichier on commence ?**
