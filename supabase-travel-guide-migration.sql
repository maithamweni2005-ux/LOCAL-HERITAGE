-- =====================================================================
-- Artisan travel guide (tips + transport per site)
-- Run once in the Supabase SQL editor.
-- =====================================================================

-- 1. Link tips and transport options to the artisan + site that added them.
--    Existing admin-created rows keep NULLs and behave exactly as before.
ALTER TABLE public.travel_tips
  ADD COLUMN IF NOT EXISTS artisan_id uuid REFERENCES public.artisans(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS site_id    uuid REFERENCES public.tourist_sites(id) ON DELETE CASCADE;

ALTER TABLE public.transport_options
  ADD COLUMN IF NOT EXISTS artisan_id uuid REFERENCES public.artisans(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS site_id    uuid REFERENCES public.tourist_sites(id) ON DELETE CASCADE;

-- A site may have no region, so a host's transport option must be allowed without one.
ALTER TABLE public.transport_options ALTER COLUMN region_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS travel_tips_site_idx        ON public.travel_tips (site_id);
CREATE INDEX IF NOT EXISTS transport_options_site_idx  ON public.transport_options (site_id);

-- 2. Row Level Security: artisans manage ONLY items attached to their own sites.
--    (Existing read/admin policies are untouched; permissive policies combine with OR.)
ALTER TABLE public.travel_tips        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_options  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "artisans manage own site tips" ON public.travel_tips;
CREATE POLICY "artisans manage own site tips" ON public.travel_tips
  FOR ALL TO authenticated
  USING (
    artisan_id IN (SELECT a.id FROM public.artisans a WHERE a.user_id = auth.uid())
  )
  WITH CHECK (
    artisan_id IN (SELECT a.id FROM public.artisans a WHERE a.user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.tourist_sites s
      WHERE s.id = travel_tips.site_id AND s.artisan_id = travel_tips.artisan_id
    )
  );

DROP POLICY IF EXISTS "artisans manage own site transport" ON public.transport_options;
CREATE POLICY "artisans manage own site transport" ON public.transport_options
  FOR ALL TO authenticated
  USING (
    artisan_id IN (SELECT a.id FROM public.artisans a WHERE a.user_id = auth.uid())
  )
  WITH CHECK (
    artisan_id IN (SELECT a.id FROM public.artisans a WHERE a.user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.tourist_sites s
      WHERE s.id = transport_options.site_id AND s.artisan_id = transport_options.artisan_id
    )
  );

-- 3. Travellers (and logged-out visitors) must be able to READ these tables.
--    You almost certainly already have a select policy for the Travel Guide tab.
--    Only run the two statements below if travellers can't see the new items.
-- CREATE POLICY "public read tips"      ON public.travel_tips       FOR SELECT USING (true);
-- CREATE POLICY "public read transport" ON public.transport_options FOR SELECT USING (true);
