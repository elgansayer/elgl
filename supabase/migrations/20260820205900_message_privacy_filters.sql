-- Issue #772: Telegram-style controls for who may start a direct conversation.
-- The application API stores these preferences in users.message_filters.  The
-- database trigger is the final enforcement boundary so alternative clients
-- cannot bypass the recipient's privacy choices.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS message_filters jsonb NOT NULL
  DEFAULT '{"enabled":false,"allowEveryone":true}'::jsonb;

COMMENT ON COLUMN public.users.message_filters IS
  'Privacy rules applied to the first message a sender posts in a direct chat.';

CREATE OR REPLACE FUNCTION public.enforce_message_privacy_filters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  receiver_id uuid;
  member_count integer;
  receiver_profile jsonb;
  sender_profile jsonb;
  filters jsonb;
  allowed_genders jsonb;
  allowed_native_languages jsonb;
  sender_gender text;
  receiver_gender text;
  sender_age integer;
  receiver_age integer;
  age_min integer;
  age_max integer;
  filtering_enabled boolean;
  allow_everyone boolean;
BEGIN
  IF NEW.room_id IS NULL OR NEW.sender_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Message filters are only for one-to-one chats. Group membership is not a
  -- useful proxy for who is allowed to post to a group.
  SELECT count(*)
    INTO member_count
    FROM public.chat_room_members
   WHERE room_id = NEW.room_id;

  IF member_count <> 2 THEN
    RETURN NEW;
  END IF;

  SELECT user_id
    INTO receiver_id
    FROM public.chat_room_members
   WHERE room_id = NEW.room_id
     AND user_id <> NEW.sender_id
   LIMIT 1;

  IF receiver_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Existing conversations remain usable. Filters only gate the sender's
  -- first message to this recipient in this direct room.
  IF EXISTS (
    SELECT 1
      FROM public.chat_messages
     WHERE room_id = NEW.room_id
       AND sender_id = NEW.sender_id
     LIMIT 1
  ) THEN
    RETURN NEW;
  END IF;

  SELECT to_jsonb(u) INTO receiver_profile
    FROM public.users u
   WHERE u.id = receiver_id;

  IF receiver_profile IS NULL THEN
    RETURN NEW;
  END IF;

  filters := COALESCE(receiver_profile -> 'message_filters', '{}'::jsonb);

  -- Old installations may already contain the legacy snake_case fields. If
  -- there is no explicit enabled switch, preserve those rules rather than
  -- silently making the account less private.
  filtering_enabled := CASE
    WHEN filters ? 'enabled' THEN COALESCE((filters ->> 'enabled')::boolean, false)
    ELSE filters ?| ARRAY[
      'allowed_genders', 'allowedGenders',
      'allowed_native_languages',
      'age_min', 'age_max', 'ageMin', 'ageMax',
      'sameNativeLanguage', 'sameTargetLanguage', 'sameGender', 'sameAge'
    ]
  END;

  allow_everyone := CASE
    WHEN filters ? 'allowEveryone' THEN COALESCE((filters ->> 'allowEveryone')::boolean, false)
    ELSE false
  END;

  IF NOT filtering_enabled OR allow_everyone THEN
    RETURN NEW;
  END IF;

  SELECT to_jsonb(u) INTO sender_profile
    FROM public.users u
   WHERE u.id = NEW.sender_id;

  -- A restrictive rule cannot be safely evaluated without a sender profile.
  IF sender_profile IS NULL THEN
    RAISE EXCEPTION 'message_not_allowed_by_recipient_filters'
      USING ERRCODE = 'P0001';
  END IF;

  sender_gender := lower(NULLIF(sender_profile ->> 'gender', ''));
  receiver_gender := lower(NULLIF(receiver_profile ->> 'gender', ''));

  allowed_genders := COALESCE(
    filters -> 'allowedGenders',
    filters -> 'allowed_genders',
    '[]'::jsonb
  );

  IF jsonb_typeof(allowed_genders) = 'array'
     AND jsonb_array_length(allowed_genders) > 0
     AND (
       sender_gender IS NULL OR NOT EXISTS (
         SELECT 1
           FROM jsonb_array_elements_text(allowed_genders) AS allowed(value)
          WHERE lower(allowed.value) = sender_gender
       )
     ) THEN
    RAISE EXCEPTION 'message_not_allowed_by_recipient_filters'
      USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE((filters ->> 'sameGender')::boolean, false)
     AND (sender_gender IS NULL OR receiver_gender IS NULL OR sender_gender <> receiver_gender) THEN
    RAISE EXCEPTION 'message_not_allowed_by_recipient_filters'
      USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE((filters ->> 'sameNativeLanguage')::boolean, false)
     AND NOT EXISTS (
       SELECT 1
         FROM jsonb_array_elements_text(
           CASE WHEN jsonb_typeof(sender_profile -> 'native_languages') = 'array'
             THEN sender_profile -> 'native_languages' ELSE '[]'::jsonb END
         ) AS sender_language(value)
         JOIN jsonb_array_elements_text(
           CASE WHEN jsonb_typeof(receiver_profile -> 'native_languages') = 'array'
             THEN receiver_profile -> 'native_languages' ELSE '[]'::jsonb END
         ) AS receiver_language(value)
           ON lower(sender_language.value) = lower(receiver_language.value)
     ) THEN
    RAISE EXCEPTION 'message_not_allowed_by_recipient_filters'
      USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE((filters ->> 'sameTargetLanguage')::boolean, false)
     AND NOT EXISTS (
       SELECT 1
         FROM jsonb_array_elements_text(
           CASE WHEN jsonb_typeof(sender_profile -> 'target_languages') = 'array'
             THEN sender_profile -> 'target_languages' ELSE '[]'::jsonb END
         ) AS sender_language(value)
         JOIN jsonb_array_elements_text(
           CASE WHEN jsonb_typeof(receiver_profile -> 'target_languages') = 'array'
             THEN receiver_profile -> 'target_languages' ELSE '[]'::jsonb END
         ) AS receiver_language(value)
           ON lower(sender_language.value) = lower(receiver_language.value)
     ) THEN
    RAISE EXCEPTION 'message_not_allowed_by_recipient_filters'
      USING ERRCODE = 'P0001';
  END IF;

  allowed_native_languages := COALESCE(
    filters -> 'allowedNativeLanguages',
    filters -> 'allowed_native_languages',
    '[]'::jsonb
  );

  IF jsonb_typeof(allowed_native_languages) = 'array'
     AND jsonb_array_length(allowed_native_languages) > 0
     AND NOT EXISTS (
       SELECT 1
         FROM jsonb_array_elements_text(
           CASE WHEN jsonb_typeof(sender_profile -> 'native_languages') = 'array'
             THEN sender_profile -> 'native_languages' ELSE '[]'::jsonb END
         ) AS sender_language(value)
         JOIN jsonb_array_elements_text(allowed_native_languages) AS allowed(value)
           ON lower(sender_language.value) = lower(allowed.value)
     ) THEN
    RAISE EXCEPTION 'message_not_allowed_by_recipient_filters'
      USING ERRCODE = 'P0001';
  END IF;

  sender_age := CASE
    WHEN COALESCE(sender_profile ->> 'age', '') ~ '^[0-9]+$'
      THEN (sender_profile ->> 'age')::integer
    ELSE NULL
  END;
  receiver_age := CASE
    WHEN COALESCE(receiver_profile ->> 'age', '') ~ '^[0-9]+$'
      THEN (receiver_profile ->> 'age')::integer
    ELSE NULL
  END;

  IF COALESCE((filters ->> 'sameAge')::boolean, false)
     AND (sender_age IS NULL OR receiver_age IS NULL OR sender_age <> receiver_age) THEN
    RAISE EXCEPTION 'message_not_allowed_by_recipient_filters'
      USING ERRCODE = 'P0001';
  END IF;

  age_min := CASE
    WHEN COALESCE(filters ->> 'ageMin', filters ->> 'age_min', '') ~ '^[0-9]+$'
      THEN COALESCE(filters ->> 'ageMin', filters ->> 'age_min')::integer
    ELSE NULL
  END;
  age_max := CASE
    WHEN COALESCE(filters ->> 'ageMax', filters ->> 'age_max', '') ~ '^[0-9]+$'
      THEN COALESCE(filters ->> 'ageMax', filters ->> 'age_max')::integer
    ELSE NULL
  END;

  IF age_min IS NOT NULL AND (sender_age IS NULL OR sender_age < age_min) THEN
    RAISE EXCEPTION 'message_not_allowed_by_recipient_filters'
      USING ERRCODE = 'P0001';
  END IF;

  IF age_max IS NOT NULL AND (sender_age IS NULL OR sender_age > age_max) THEN
    RAISE EXCEPTION 'message_not_allowed_by_recipient_filters'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_message_privacy_filters ON public.chat_messages;
CREATE TRIGGER enforce_message_privacy_filters
BEFORE INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.enforce_message_privacy_filters();
