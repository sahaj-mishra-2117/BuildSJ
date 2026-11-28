CREATE OR REPLACE FUNCTION public.get_neighborhood_checklist_counts()
RETURNS TABLE (neighborhood text, participants bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT p.neighborhood::text, pg_catalog.count(DISTINCT p.id)
    FROM public.profiles AS p
    WHERE p.neighborhood IS NOT NULL
      AND pg_catalog.btrim(p.neighborhood) <> ''
      AND p.tasks_completed > 0
    GROUP BY p.neighborhood
    HAVING pg_catalog.count(DISTINCT p.id) >= 5
    ORDER BY p.neighborhood;
$function$;

REVOKE ALL ON FUNCTION public.get_neighborhood_checklist_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_neighborhood_checklist_counts() TO anon, authenticated;
