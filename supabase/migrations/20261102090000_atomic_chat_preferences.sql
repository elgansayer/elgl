-- Merge partial chat preference updates in one PostgreSQL statement so
-- concurrent saves cannot replace unrelated settings written by another client.

CREATE OR REPLACE FUNCTION public.merge_chat_preferences(
    p_user_id UUID,
    p_patch JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_preferences JSONB;
    v_allowed_keys CONSTANT TEXT[] := ARRAY[
        'autoTranslate',
        'readReceipts',
        'enterToSend',
        'textSize',
        'disappearingMessagesTtl',
        'showDetailedExplanations',
        'defaultTranslationLanguage'
    ];
BEGIN
    IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
        RAISE EXCEPTION 'chat preference patch must be an object'
            USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM jsonb_object_keys(p_patch) AS supplied(key)
         WHERE NOT supplied.key = ANY (v_allowed_keys)
    ) THEN
        RAISE EXCEPTION 'chat preference patch contains an unsupported key'
            USING ERRCODE = '22023';
    END IF;

    UPDATE public.users
       SET chat_preferences = COALESCE(chat_preferences, '{}'::JSONB) || p_patch
     WHERE id = p_user_id
     RETURNING chat_preferences INTO v_preferences;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002';
    END IF;

    RETURN v_preferences;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_chat_preferences(UUID, JSONB)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_chat_preferences(UUID, JSONB)
    TO service_role;
