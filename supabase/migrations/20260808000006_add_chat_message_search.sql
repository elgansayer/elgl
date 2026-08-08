-- Add a server-side pg_trgm similarity search function for chat messages
-- The extension and GIN index already exist (see 001_initial_schema.sql and 003_chat_and_favourites.sql)

CREATE OR REPLACE FUNCTION public.search_chat_messages(
  p_room_id TEXT,
  p_query TEXT,
  p_similarity_threshold REAL DEFAULT 0.15
) RETURNS TABLE(
  id UUID,
  room_id TEXT,
  sender_id UUID,
  message_type VARCHAR(50),
  text_content TEXT,
  media_url TEXT,
  correction_payload JSONB,
  is_read BOOLEAN,
  created_at TIMESTAMPTZ,
  similarity_score REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cm.id,
    cm.room_id,
    cm.sender_id,
    cm.message_type,
    cm.text_content,
    cm.media_url,
    cm.correction_payload,
    cm.is_read,
    cm.created_at,
    similarity(cm.text_content, p_query)::REAL AS similarity_score
  FROM public.chat_messages cm
  WHERE cm.room_id = p_room_id
    AND cm.text_content IS NOT NULL
    AND similarity(cm.text_content, p_query) > p_similarity_threshold
  ORDER BY similarity(cm.text_content, p_query) DESC, cm.created_at ASC
  LIMIT 100;
END;
$$ LANGUAGE plpgsql STABLE PARALLEL SAFE;
