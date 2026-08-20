-- Issue #772: make "Who can message me" filters authoritative at the database
-- boundary. The application already exposes age, gender and native-language
-- settings and checks them before the first message. This trigger prevents an
-- alternate writer from bypassing the same policy.

CREATE OR REPLACE FUNCTION public.validate_message_filters_jsonb(filters jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  age_min_value integer;
  age_max_value integer;
  value_text text;
BEGIN
  IF filters IS NULL THEN
    RETURN true;
  END IF;

  IF jsonb_typeof(filters) <> 'object' THEN
    RETURN false;
  END IF;

  IF filters ? 'age_min' THEN
    IF jsonb_typeof(filters -> 'age_min') <> 'number' THEN
      RETURN false;
    END IF;
    age_min_value := (filters ->> 'age_min')::integer;
    IF age_min_value < 0 OR age_min_value > 150 THEN
      RETURN false;
    END IF;
  END IF;

  IF filters ? 'age_max' THEN
    IF jsonb_typeof(filters -> 'age_max') <> 'number' THEN
      RETURN false;
    END IF;
    age_max_value := (filters ->> 'age_max')::integer;
    IF age_max_value < 0 OR age_max_value > 150 THEN
      RETURN false;
    END IF;
  END IF;

  IF age_min_value IS NOT NULL AND age_max_value IS NOT NULL AND age_min_value > age_max_value THEN
    RETURN false;
  END IF;

  IF filters ? 'allowed_native_languages' THEN
    IF jsonb_typeof(filters -> 'allowed_native_languages') <> 'array'
      OR jsonb_array_length(filters -> 'allowed_native_languages') > 32 THEN
      RETURN false;
    END IF;

    FOR value_text IN
      SELECT jsonb_array_elements_text(filters -> 'allowed_native_languages')
    LOOP
      IF value_text = '' OR char_length(value_text) > 35 THEN
        RETURN false;
      END IF;
    END LOOP;
  END IF;

  IF filters ? 'allowed_genders' THEN
    IF jsonb_typeof(filters -> 'allowed_genders') <> 'array'
      OR jsonb_array_length(filters -> 'allowed_genders') > 3 THEN
      RETURN false;
    END IF;

    FOR value_text IN
      SELECT jsonb_array_elements_text(filters -> 'allowed_genders')
    LOOP
      IF value_text NOT IN ('male', 'female', 'other') THEN
        RETURN false;
      END IF;
    END LOOP;
  END IF;

  -- Reject unknown policy keys instead of silently persisting settings the
  -- enforcement layer does not understand.
  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(filters) AS key_name
    WHERE key_name NOT IN (
      'age_min',
      'age_max',
      'allowed_native_languages',
      'allowed_genders'
    )
  ) THEN
    RETURN false;
  END IF;

  RETURN true;
EXCEPTION
  WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RETURN false;
END;
$$;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_message_filters_valid;

ALTER TABLE public.users
  ADD CONSTRAINT users_message_filters_valid
  CHECK (public.validate_message_filters_jsonb(message_filters))
  NOT VALID;

COMMENT ON CONSTRAINT users_message_filters_valid ON public.users IS
  'New/updated message filters must use the age, native-language and gender policy schema used by first-contact enforcement.';

CREATE OR REPLACE FUNCTION public.enforce_first_contact_message_filters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  receiver_id uuid;
  other_member_count integer;
  receiver_filters jsonb;
  sender_age integer;
  sender_gender text;
  sender_native_languages jsonb;
  allowed_languages jsonb;
  allowed_genders jsonb;
  age_min_value integer;
  age_max_value integer;
BEGIN
  -- Message filters apply to the start of a direct conversation. Once the room
  -- contains a message, both participants can continue the established thread.
  IF EXISTS (
    SELECT 1
    FROM public.chat_messages existing
    WHERE existing.room_id::text = NEW.room_id::text
    LIMIT 1
  ) THEN
    RETURN NEW;
  END IF;

  SELECT count(*)
  INTO other_member_count
  FROM public.chat_room_members member
  WHERE member.room_id::text = NEW.room_id::text
    AND member.user_id <> NEW.sender_id;

  -- Group rooms and incomplete room membership are outside this direct-message
  -- first-contact policy. Group membership/permission checks remain owned by
  -- the chat service.
  IF other_member_count <> 1 THEN
    RETURN NEW;
  END IF;

  SELECT member.user_id
  INTO receiver_id
  FROM public.chat_room_members member
  WHERE member.room_id::text = NEW.room_id::text
    AND member.user_id <> NEW.sender_id
  LIMIT 1;

  SELECT user_row.message_filters
  INTO receiver_filters
  FROM public.users user_row
  WHERE user_row.id = receiver_id;

  IF receiver_filters IS NULL OR receiver_filters = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  IF NOT public.validate_message_filters_jsonb(receiver_filters) THEN
    RAISE EXCEPTION 'Recipient message filters are temporarily unavailable'
      USING ERRCODE = '55000';
  END IF;

  SELECT
    user_row.age,
    user_row.gender,
    to_jsonb(user_row.native_languages)
  INTO sender_age, sender_gender, sender_native_languages
  FROM public.users user_row
  WHERE user_row.id = NEW.sender_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unable to verify sender eligibility'
      USING ERRCODE = '55000';
  END IF;

  allowed_languages := receiver_filters -> 'allowed_native_languages';
  IF allowed_languages IS NOT NULL AND jsonb_array_length(allowed_languages) > 0 THEN
    IF sender_native_languages IS NULL
      OR jsonb_typeof(sender_native_languages) <> 'array'
      OR jsonb_array_length(sender_native_languages) = 0
      OR NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(sender_native_languages) sender_language(language_code)
        JOIN jsonb_array_elements_text(allowed_languages) allowed_language(language_code)
          ON lower(allowed_language.language_code) = lower(sender_language.language_code)
      ) THEN
      RAISE EXCEPTION 'Initial message is not allowed by recipient message filters'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF receiver_filters ? 'age_min' THEN
    age_min_value := (receiver_filters ->> 'age_min')::integer;
    IF sender_age IS NULL OR sender_age < age_min_value THEN
      RAISE EXCEPTION 'Initial message is not allowed by recipient message filters'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF receiver_filters ? 'age_max' THEN
    age_max_value := (receiver_filters ->> 'age_max')::integer;
    IF sender_age IS NULL OR sender_age > age_max_value THEN
      RAISE EXCEPTION 'Initial message is not allowed by recipient message filters'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  allowed_genders := receiver_filters -> 'allowed_genders';
  IF allowed_genders IS NOT NULL AND jsonb_array_length(allowed_genders) > 0 THEN
    IF sender_gender IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(allowed_genders) allowed_gender(gender_value)
        WHERE allowed_gender.gender_value = sender_gender
      ) THEN
      RAISE EXCEPTION 'Initial message is not allowed by recipient message filters'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_first_contact_message_filters() FROM PUBLIC;

DROP TRIGGER IF EXISTS enforce_first_contact_message_filters ON public.chat_messages;
CREATE TRIGGER enforce_first_contact_message_filters
  BEFORE INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_first_contact_message_filters();

COMMENT ON FUNCTION public.enforce_first_contact_message_filters() IS
  'Enforces recipient age, gender and native-language filters on the first message of a direct chat. Missing filtered sender attributes fail closed.';
