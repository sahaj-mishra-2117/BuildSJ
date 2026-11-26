ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS checklist_answers jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.set_checklist_answer(
    p_item_id text,
    p_checked boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_answers jsonb;
    v_completed integer;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication is required.';
    END IF;

    IF p_item_id IS NULL
       OR NOT (p_item_id = ANY (ARRAY[
           'check_item1', 'check_item2', 'check_item3', 'check_item4',
           'check_item5', 'check_item6', 'check_item7', 'check_item8',
           'check_item9', 'check_item10', 'check_item11', 'check_item12',
           'check_item13', 'check_item14'
       ]::text[]))
       OR p_checked IS NULL THEN
        RAISE EXCEPTION 'Invalid checklist answer.';
    END IF;

    INSERT INTO public.profiles AS current_profile (
        id,
        email,
        checked_in,
        progress_percentage,
        tasks_completed,
        checklist_answers
    )
    VALUES (
        v_user_id,
        auth.jwt() ->> 'email',
        false,
        0,
        0,
        pg_catalog.jsonb_build_object(p_item_id, p_checked)
    )
    ON CONFLICT (id) DO UPDATE
    SET checklist_answers =
        COALESCE(current_profile.checklist_answers, '{}'::jsonb)
        || pg_catalog.jsonb_build_object(p_item_id, p_checked)
    RETURNING current_profile.checklist_answers INTO v_answers;

    SELECT pg_catalog.count(*)::integer
    INTO v_completed
    FROM pg_catalog.unnest(ARRAY[
        'check_item1', 'check_item2', 'check_item3', 'check_item4',
        'check_item5', 'check_item6', 'check_item7', 'check_item8',
        'check_item9', 'check_item10', 'check_item11', 'check_item12',
        'check_item13', 'check_item14'
    ]::text[]) AS item(item_id)
    WHERE v_answers -> item.item_id = 'true'::jsonb;

    UPDATE public.profiles
    SET tasks_completed = v_completed,
        progress_percentage = pg_catalog.round(v_completed * 100.0 / 14),
        checked_in = (v_completed = 14)
    WHERE id = v_user_id;

    RETURN v_answers;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_checklist_answer(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_checklist_answer(text, boolean) TO authenticated;

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
