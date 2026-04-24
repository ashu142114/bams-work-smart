-- Roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'hr', 'leader', 'employee');

-- Companies (tenants)
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  office_lat DOUBLE PRECISION,
  office_lng DOUBLE PRECISION,
  geofence_radius_m INTEGER NOT NULL DEFAULT 200,
  work_start TIME NOT NULL DEFAULT '09:30',
  late_after TIME NOT NULL DEFAULT '09:45',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Teams
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  leader_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  monthly_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles (separate table to prevent privilege escalation)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Attendance
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  punch_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  punch_out_at TIMESTAMPTZ,
  in_lat DOUBLE PRECISION,
  in_lng DOUBLE PRECISION,
  out_lat DOUBLE PRECISION,
  out_lng DOUBLE PRECISION,
  selfie_url TEXT,
  status TEXT NOT NULL DEFAULT 'present', -- present | late
  work_update TEXT,
  task_update TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

-- Security definer functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_user_company(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = _user_id
$$;

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Companies policies
CREATE POLICY "Users view own company" ON public.companies FOR SELECT
  USING (id = public.get_user_company(auth.uid()));
CREATE POLICY "Admins update own company" ON public.companies FOR UPDATE
  USING (id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone authenticated can insert company" ON public.companies FOR INSERT
  TO authenticated WITH CHECK (true);

-- Teams policies
CREATE POLICY "Users view teams in company" ON public.teams FOR SELECT
  USING (company_id = public.get_user_company(auth.uid()));
CREATE POLICY "Admins manage teams" ON public.teams FOR ALL
  USING (company_id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (company_id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- Profiles policies
CREATE POLICY "Users view profiles in company" ON public.profiles FOR SELECT
  USING (company_id = public.get_user_company(auth.uid()) OR id = auth.uid());
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE
  USING (id = auth.uid());
CREATE POLICY "Admins/HR update profiles in company" ON public.profiles FOR UPDATE
  USING (company_id = public.get_user_company(auth.uid())
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr')));
CREATE POLICY "Insert own profile on signup" ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- User roles policies
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT
  USING (user_id = auth.uid() OR company_id = public.get_user_company(auth.uid()));
CREATE POLICY "Admins manage roles in company" ON public.user_roles FOR ALL
  USING (company_id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (company_id = public.get_user_company(auth.uid()) AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Self insert employee role on signup" ON public.user_roles FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Attendance policies
CREATE POLICY "Users view own attendance" ON public.attendance FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "Managers view company attendance" ON public.attendance FOR SELECT
  USING (company_id = public.get_user_company(auth.uid())
    AND (public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'hr')
      OR public.has_role(auth.uid(), 'leader')));
CREATE POLICY "Users insert own attendance" ON public.attendance FOR INSERT
  WITH CHECK (user_id = auth.uid() AND company_id = public.get_user_company(auth.uid()));
CREATE POLICY "Users update own attendance" ON public.attendance FOR UPDATE
  USING (user_id = auth.uid());

-- Storage bucket for selfies
INSERT INTO storage.buckets (id, name, public) VALUES ('selfies', 'selfies', true);

CREATE POLICY "Selfies are publicly viewable" ON storage.objects FOR SELECT
  USING (bucket_id = 'selfies');
CREATE POLICY "Users upload own selfies" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'selfies' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();