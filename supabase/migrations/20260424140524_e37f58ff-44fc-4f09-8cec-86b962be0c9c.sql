-- Fix function search_path
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Tighten selfies bucket: users can only view files in their own folder
DROP POLICY IF EXISTS "Selfies are publicly viewable" ON storage.objects;
CREATE POLICY "Users view own selfies" ON storage.objects FOR SELECT
  USING (bucket_id = 'selfies' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Managers view company selfies" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'selfies' AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.company_id = public.get_user_company(auth.uid())
        AND (public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'hr')
          OR public.has_role(auth.uid(), 'leader'))
    )
  );

-- Tighten company insert: only allow when user has no company yet (initial onboarding)
DROP POLICY IF EXISTS "Anyone authenticated can insert company" ON public.companies;
CREATE POLICY "First-time signup creates company" ON public.companies FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_company(auth.uid()) IS NULL);