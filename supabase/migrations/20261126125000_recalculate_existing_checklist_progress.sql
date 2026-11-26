WITH checklist_items(item_id) AS (
    VALUES
        ('check_item1'), ('check_item2'), ('check_item3'), ('check_item4'),
        ('check_item5'), ('check_item6'), ('check_item7'), ('check_item8'),
        ('check_item9'), ('check_item10'), ('check_item13'), ('check_item14'),
        ('check_item15'), ('check_item16'), ('check_item17'),
        ('check_item33'), ('check_item34'), ('check_item35'), ('check_item36'),
        ('check_item37'), ('check_item38'), ('check_item39'), ('check_item40'),
        ('check_item41'), ('check_item42')
),
profile_progress AS (
    SELECT
        profile.id,
        profile.tasks_completed AS legacy_tasks_completed,
        pg_catalog.count(*) FILTER (
            WHERE profile.checklist_answers -> checklist_items.item_id = 'true'::jsonb
        )::integer AS answered_tasks_completed,
        pg_catalog.bool_or(
            COALESCE(profile.checklist_answers, '{}'::jsonb) ? checklist_items.item_id
        ) AS has_saved_answers
    FROM public.profiles AS profile
    CROSS JOIN checklist_items
    GROUP BY profile.id, profile.tasks_completed, profile.checklist_answers
)
UPDATE public.profiles AS profile
SET tasks_completed = CASE
        WHEN profile_progress.has_saved_answers THEN profile_progress.answered_tasks_completed
        ELSE LEAST(25, GREATEST(0, COALESCE(profile_progress.legacy_tasks_completed, 0)))
    END,
    progress_percentage = pg_catalog.round(
        CASE
            WHEN profile_progress.has_saved_answers THEN profile_progress.answered_tasks_completed
            ELSE LEAST(25, GREATEST(0, COALESCE(profile_progress.legacy_tasks_completed, 0)))
        END * 100.0 / 25
    ),
    checked_in = profile_progress.has_saved_answers
        AND profile_progress.answered_tasks_completed = 25
FROM profile_progress
WHERE profile.id = profile_progress.id;
