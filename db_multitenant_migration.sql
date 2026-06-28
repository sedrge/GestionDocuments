-- ============================================
-- MIGRATION MULTI-TENANT SENMOTO
-- Exécuter sur Supabase SQL Editor
-- ============================================

-- 1. TABLE: ENTERPRISES
CREATE TABLE IF NOT EXISTS enterprises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(20) NOT NULL UNIQUE,
  logo_url VARCHAR(500),
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- 2. TABLE: ENTERPRISE_ADMINS
CREATE TABLE IF NOT EXISTS enterprise_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  user_id UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT TRUE,
  role VARCHAR(50) DEFAULT 'enterprise_admin',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(enterprise_id, email)
);

-- 3. TABLE: ENTERPRISE_USERS
CREATE TABLE IF NOT EXISTS enterprise_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'user',
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(enterprise_id, user_id)
);

-- 4. TABLE: SUPER_ADMINS
CREATE TABLE IF NOT EXISTS super_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT now()
);

-- 5. ALTER EXISTING TABLES
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS enterprise_id UUID REFERENCES enterprises(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS enterprise_id UUID REFERENCES enterprises(id) ON DELETE CASCADE;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE enterprises ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- ENTERPRISES: Super-admin sees all, users see only their own
CREATE POLICY "super_admin_enterprises" ON enterprises
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM super_admins WHERE super_admins.user_id = auth.uid())
  );

CREATE POLICY "user_enterprises" ON enterprises
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM enterprise_users WHERE enterprise_id = enterprises.id UNION
      SELECT created_by FROM enterprises WHERE enterprises.id = enterprises.id
    )
  );

-- ENTERPRISE_ADMINS: Only admins and super-admin can see
CREATE POLICY "super_admin_admins" ON enterprise_admins
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM super_admins WHERE super_admins.user_id = auth.uid())
  );

CREATE POLICY "admin_own_admins" ON enterprise_admins
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM enterprise_admins WHERE enterprise_id = enterprise_admins.enterprise_id
    )
  );

-- ENTERPRISE_USERS: Only own users, admins, and super-admin can see
CREATE POLICY "super_admin_users" ON enterprise_users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM super_admins WHERE super_admins.user_id = auth.uid())
  );

CREATE POLICY "user_sees_self" ON enterprise_users
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "admin_sees_own_enterprise_users" ON enterprise_users
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM enterprise_admins WHERE enterprise_id = enterprise_users.enterprise_id
    )
  );

-- DOCUMENTS: Only users of the enterprise can see
CREATE POLICY "super_admin_docs" ON documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM super_admins WHERE super_admins.user_id = auth.uid())
  );

CREATE POLICY "user_docs" ON documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM enterprise_users
      WHERE enterprise_users.user_id = auth.uid()
        AND enterprise_users.enterprise_id = documents.enterprise_id
        AND enterprise_users.is_active = TRUE
    )
  );

-- CATEGORIES: Only users of the enterprise can see
CREATE POLICY "super_admin_categories" ON categories
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM super_admins WHERE super_admins.user_id = auth.uid())
  );

CREATE POLICY "user_categories" ON categories
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM enterprise_users
      WHERE enterprise_users.user_id = auth.uid()
        AND enterprise_users.enterprise_id = categories.enterprise_id
    )
  );

-- ============================================
-- INSERT YOURSELF AS SUPER-ADMIN
-- ============================================
-- Remplacez 'YOUR_USER_ID_HERE' par votre UUID utilisateur Supabase
-- INSERT INTO super_admins (user_id) VALUES ('YOUR_USER_ID_HERE');

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_enterprises_code ON enterprises(code);
CREATE INDEX IF NOT EXISTS idx_enterprises_is_active ON enterprises(is_active);
CREATE INDEX IF NOT EXISTS idx_enterprise_admins_enterprise ON enterprise_admins(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_admins_user ON enterprise_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_users_enterprise ON enterprise_users(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_users_user ON enterprise_users(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_enterprise ON documents(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_categories_enterprise ON categories(enterprise_id);
