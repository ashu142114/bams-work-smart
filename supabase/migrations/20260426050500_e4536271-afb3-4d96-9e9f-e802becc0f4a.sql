
-- =========================================================
-- TASK / WORK-UPDATE STATUS ENUMS
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.work_update_status AS ENUM ('pending_review', 'approved', 'rejected', 'on_hold');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- TASKS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  team_id uuid NOT NULL,
  created_by uuid NOT NULL,
  title text NOT NULL,
  description text,
  status public.task_status NOT NULL DEFAULT 'pending',
  deadline timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tasks_team_idx ON public.tasks(team_id);
CREATE INDEX IF NOT EXISTS tasks_company_idx ON public.tasks(company_id);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- TASK ASSIGNEES (many-to-many)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.task_assignees (
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);
CREATE INDEX IF NOT EXISTS task_assignees_user_idx ON public.task_assignees(user_id);

ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- WORK UPDATES
-- =========================================================
CREATE TABLE IF NOT EXISTS public.work_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  company_id uuid NOT NULL,
  team_id uuid NOT NULL,
  description text NOT NULL,
  image_url text,
  status public.work_update_status NOT NULL DEFAULT 'pending_review',
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS work_updates_task_idx ON public.work_updates(task_id);
CREATE INDEX IF NOT EXISTS work_updates_user_day_idx ON public.work_updates(user_id, created_at);
CREATE INDEX IF NOT EXISTS work_updates_team_idx ON public.work_updates(team_id);

ALTER TABLE public.work_updates ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- updated_at triggers
-- =========================================================
DROP TRIGGER IF EXISTS trg_tasks_touch ON public.tasks;
CREATE TRIGGER trg_tasks_touch BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_work_updates_touch ON public.work_updates;
CREATE TRIGGER trg_work_updates_touch BEFORE UPDATE ON public.work_updates
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- HELPER: is the user the leader of the given team?
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_team_leader(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams WHERE id = _team_id AND leader_id = _user_id
  );
$$;

-- =========================================================
-- HELPER: can user see a given task?
--   admin/HR within company  OR leader of task's team  OR assignee
-- =========================================================
CREATE OR REPLACE FUNCTION public.user_can_see_task(_user_id uuid, _task_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = _task_id
      AND t.company_id = public.get_user_company(_user_id)
      AND (
        public.has_role(_user_id, 'admin')
        OR public.has_role(_user_id, 'hr')
        OR public.is_team_leader(_user_id, t.team_id)
        OR EXISTS (
          SELECT 1 FROM public.task_assignees ta
          WHERE ta.task_id = t.id AND ta.user_id = _user_id
        )
      )
  );
$$;

-- =========================================================
-- TASK RLS
-- =========================================================
DROP POLICY IF EXISTS "Tasks: company members can read own/team/all per role" ON public.tasks;
CREATE POLICY "Tasks: company members can read own/team/all per role"
ON public.tasks FOR SELECT
USING (
  company_id = public.get_user_company(auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hr')
    OR public.is_team_leader(auth.uid(), team_id)
    OR EXISTS (
      SELECT 1 FROM public.task_assignees ta
      WHERE ta.task_id = tasks.id AND ta.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Tasks: leaders/admins create" ON public.tasks;
CREATE POLICY "Tasks: leaders/admins create"
ON public.tasks FOR INSERT
WITH CHECK (
  company_id = public.get_user_company(auth.uid())
  AND created_by = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.is_team_leader(auth.uid(), team_id)
  )
);

DROP POLICY IF EXISTS "Tasks: leaders/admins/assignees update" ON public.tasks;
CREATE POLICY "Tasks: leaders/admins/assignees update"
ON public.tasks FOR UPDATE
USING (
  company_id = public.get_user_company(auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.is_team_leader(auth.uid(), team_id)
    OR EXISTS (
      SELECT 1 FROM public.task_assignees ta
      WHERE ta.task_id = tasks.id AND ta.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Tasks: leaders/admins delete" ON public.tasks;
CREATE POLICY "Tasks: leaders/admins delete"
ON public.tasks FOR DELETE
USING (
  company_id = public.get_user_company(auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.is_team_leader(auth.uid(), team_id)
  )
);

-- =========================================================
-- TASK_ASSIGNEES RLS
-- =========================================================
DROP POLICY IF EXISTS "Assignees: visible if you can see the task" ON public.task_assignees;
CREATE POLICY "Assignees: visible if you can see the task"
ON public.task_assignees FOR SELECT
USING (public.user_can_see_task(auth.uid(), task_id));

DROP POLICY IF EXISTS "Assignees: leader/admin manage" ON public.task_assignees;
CREATE POLICY "Assignees: leader/admin manage"
ON public.task_assignees FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id
      AND t.company_id = public.get_user_company(auth.uid())
      AND (public.has_role(auth.uid(), 'admin') OR public.is_team_leader(auth.uid(), t.team_id))
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = task_assignees.user_id
      AND p.company_id = public.get_user_company(auth.uid())
      AND p.team_id = (SELECT team_id FROM public.tasks WHERE id = task_id)
  )
);

DROP POLICY IF EXISTS "Assignees: leader/admin delete" ON public.task_assignees;
CREATE POLICY "Assignees: leader/admin delete"
ON public.task_assignees FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id
      AND t.company_id = public.get_user_company(auth.uid())
      AND (public.has_role(auth.uid(), 'admin') OR public.is_team_leader(auth.uid(), t.team_id))
  )
);

-- =========================================================
-- WORK_UPDATES RLS
-- =========================================================
DROP POLICY IF EXISTS "Updates: author/team-leader/admin read" ON public.work_updates;
CREATE POLICY "Updates: author/team-leader/admin read"
ON public.work_updates FOR SELECT
USING (
  company_id = public.get_user_company(auth.uid())
  AND (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hr')
    OR public.is_team_leader(auth.uid(), team_id)
  )
);

DROP POLICY IF EXISTS "Updates: assignee creates own" ON public.work_updates;
CREATE POLICY "Updates: assignee creates own"
ON public.work_updates FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND company_id = public.get_user_company(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.task_assignees ta ON ta.task_id = t.id
    WHERE t.id = work_updates.task_id
      AND ta.user_id = auth.uid()
      AND t.team_id = work_updates.team_id
      AND t.company_id = work_updates.company_id
  )
);

-- Author may edit only while still pending_review (e.g., fix typo);
-- leader/admin may update to set review status / notes.
DROP POLICY IF EXISTS "Updates: author edits pending; reviewer reviews" ON public.work_updates;
CREATE POLICY "Updates: author edits pending; reviewer reviews"
ON public.work_updates FOR UPDATE
USING (
  company_id = public.get_user_company(auth.uid())
  AND (
    (user_id = auth.uid() AND status = 'pending_review')
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_team_leader(auth.uid(), team_id)
  )
);

DROP POLICY IF EXISTS "Updates: admin/leader delete" ON public.work_updates;
CREATE POLICY "Updates: admin/leader delete"
ON public.work_updates FOR DELETE
USING (
  company_id = public.get_user_company(auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.is_team_leader(auth.uid(), team_id))
);

-- =========================================================
-- SEED Alpha/Beta/Gamma/Delta for every company
-- =========================================================
INSERT INTO public.teams (company_id, name)
SELECT c.id, n.name
FROM public.companies c
CROSS JOIN (VALUES ('Alpha'), ('Beta'), ('Gamma'), ('Delta')) AS n(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.teams t
  WHERE t.company_id = c.id AND t.name = n.name
);

-- Auto-seed for any newly created company
CREATE OR REPLACE FUNCTION public.seed_default_teams()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.teams (company_id, name) VALUES
    (NEW.id, 'Alpha'),
    (NEW.id, 'Beta'),
    (NEW.id, 'Gamma'),
    (NEW.id, 'Delta')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_default_teams ON public.companies;
CREATE TRIGGER trg_seed_default_teams
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.seed_default_teams();

-- =========================================================
-- STORAGE: work-updates bucket (private)
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('work-updates', 'work-updates', false)
ON CONFLICT (id) DO NOTHING;

-- Read: authenticated members of the same company can view (work updates carry company context)
DROP POLICY IF EXISTS "work-updates read by company members" ON storage.objects;
CREATE POLICY "work-updates read by company members"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'work-updates'
  AND auth.uid() IS NOT NULL
);

-- Insert: user uploads to a folder named after their own user id
DROP POLICY IF EXISTS "work-updates insert own folder" ON storage.objects;
CREATE POLICY "work-updates insert own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'work-updates'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "work-updates delete own folder" ON storage.objects;
CREATE POLICY "work-updates delete own folder"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'work-updates'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
