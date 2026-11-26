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
    v_item_ids text[] := ARRAY[
        'check_item1', 'check_item2', 'check_item3', 'check_item4',
        'check_item5', 'check_item6', 'check_item7', 'check_item8',
        'check_item9', 'check_item10', 'check_item13', 'check_item14',
        'check_item15', 'check_item16', 'check_item17',
        'check_item33', 'check_item34', 'check_item35', 'check_item36',
        'check_item37', 'check_item38', 'check_item39', 'check_item40',
        'check_item41', 'check_item42'
    ]::text[];
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication is required.';
    END IF;

    IF p_item_id IS NULL
       OR NOT (p_item_id = ANY (v_item_ids))
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
    FROM pg_catalog.unnest(v_item_ids) AS item(item_id)
    WHERE v_answers -> item.item_id = 'true'::jsonb;

    UPDATE public.profiles
    SET tasks_completed = v_completed,
        progress_percentage = pg_catalog.round(v_completed * 100.0 / pg_catalog.cardinality(v_item_ids)),
        checked_in = (v_completed = pg_catalog.cardinality(v_item_ids))
    WHERE id = v_user_id;

    RETURN v_answers;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_checklist_answer(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_checklist_answer(text, boolean) TO authenticated;
