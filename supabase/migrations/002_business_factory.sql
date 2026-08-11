-- SITEFLIP AI Business Factory schema
-- Isolated from core marketplace tables conceptually via factory_* prefix.
-- factory_secrets must NEVER store plaintext secrets in application code.

CREATE TYPE factory_project_state AS ENUM (
  'IDEA', 'PLANNING', 'RESEARCHING', 'DESIGNING', 'BUILDING', 'TESTING',
  'PREVIEW', 'APPROVAL_REQUIRED', 'DEPLOYING', 'LIVE', 'FAILED', 'PAUSED', 'ARCHIVED'
);

CREATE TYPE factory_task_status AS ENUM (
  'WAITING', 'RUNNING', 'COMPLETED', 'FAILED', 'REQUIRES_APPROVAL', 'SKIPPED'
);

CREATE TABLE factory_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  state factory_project_state NOT NULL DEFAULT 'IDEA',
  brief JSONB NOT NULL DEFAULT '{}',
  current_step TEXT,
  quality JSONB,
  growth_plan JSONB,
  sandbox JSONB NOT NULL DEFAULT '{}',
  usage JSONB NOT NULL DEFAULT '{}',
  live_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE factory_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT TRUE
);

CREATE TABLE factory_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES factory_projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  error TEXT
);

CREATE TABLE factory_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES factory_projects(id) ON DELETE CASCADE,
  run_id UUID REFERENCES factory_runs(id) ON DELETE SET NULL,
  step_id TEXT NOT NULL,
  agent TEXT NOT NULL,
  status factory_task_status NOT NULL DEFAULT 'WAITING',
  progress INTEGER DEFAULT 0,
  activity TEXT,
  error TEXT,
  attempt INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE factory_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES factory_projects(id) ON DELETE CASCADE,
  agent TEXT NOT NULL,
  schema_name TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  labeled_assumptions TEXT[] DEFAULT '{}',
  source TEXT NOT NULL,
  implementation_status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE factory_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES factory_projects(id) ON DELETE CASCADE,
  agent TEXT NOT NULL,
  reason TEXT NOT NULL,
  files_changed TEXT[] DEFAULT '{}',
  approval_status TEXT NOT NULL,
  result TEXT,
  rollback_of UUID REFERENCES factory_changes(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE factory_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES factory_projects(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  title TEXT NOT NULL,
  explanation TEXT NOT NULL,
  services TEXT[] DEFAULT '{}',
  estimated_cost_eur NUMERIC(12,2),
  risks TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE factory_builds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES factory_projects(id) ON DELETE CASCADE,
  logs TEXT[] DEFAULT '{}',
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE factory_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES factory_projects(id) ON DELETE CASCADE,
  environment TEXT NOT NULL CHECK (environment IN ('preview', 'production')),
  status TEXT NOT NULL,
  url TEXT,
  approved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE factory_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES factory_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  ai_tokens_estimated INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE factory_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES factory_projects(id) ON DELETE CASCADE,
  ai_cost_eur NUMERIC(12,4) DEFAULT 0,
  infra_monthly_eur NUMERIC(12,4) DEFAULT 0,
  third_party_monthly_eur NUMERIC(12,4) DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE factory_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES factory_projects(id) ON DELETE CASCADE,
  change_id UUID REFERENCES factory_changes(id),
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE factory_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES factory_projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
  -- NEVER store secrets in value
);

-- Encrypted secret references only (provider + key id), never plaintext
CREATE TABLE factory_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES factory_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'env',
  external_ref TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, name)
);

ALTER TABLE factory_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE factory_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE factory_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE factory_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE factory_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE factory_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE factory_builds ENABLE ROW LEVEL SECURITY;
ALTER TABLE factory_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE factory_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE factory_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE factory_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE factory_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE factory_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage factory projects"
  ON factory_projects FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "Owners see factory child rows"
  ON factory_tasks FOR ALL USING (
    EXISTS (SELECT 1 FROM factory_projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  );

CREATE POLICY "Owners see factory outputs"
  ON factory_outputs FOR ALL USING (
    EXISTS (SELECT 1 FROM factory_projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  );

CREATE POLICY "Owners see factory approvals"
  ON factory_approvals FOR ALL USING (
    EXISTS (SELECT 1 FROM factory_projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  );

CREATE POLICY "Owners see factory memory"
  ON factory_memory FOR ALL USING (
    EXISTS (SELECT 1 FROM factory_projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  );

CREATE POLICY "Owners see factory secrets refs only"
  ON factory_secrets FOR SELECT USING (
    EXISTS (SELECT 1 FROM factory_projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  );
