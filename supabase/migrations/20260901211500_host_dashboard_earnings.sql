-- Aggregate host-dashboard earnings in Postgres so the API never loads an
-- unbounded room gift history into application memory. The host predicate is
-- repeated inside the function as defence in depth against cross-host totals.

CREATE INDEX IF NOT EXISTS idx_gift_transactions_room_receiver
    ON public.gift_transactions (room_id, receiver_id);

CREATE OR REPLACE FUNCTION public.get_host_dashboard_earnings(
    p_room_id UUID,
    p_host_id UUID
)
RETURNS TABLE (earned_coins BIGINT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
    SELECT COALESCE(SUM(gt.coins_spent), 0)::BIGINT
      FROM public.audio_rooms AS ar
      LEFT JOIN public.gift_transactions AS gt
        ON gt.room_id = ar.id
       AND gt.receiver_id = ar.host_id
     WHERE ar.id = p_room_id
       AND ar.host_id = p_host_id;
$function$;

REVOKE ALL ON FUNCTION public.get_host_dashboard_earnings(UUID, UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_host_dashboard_earnings(UUID, UUID)
    TO service_role;

COMMENT ON FUNCTION public.get_host_dashboard_earnings(UUID, UUID) IS
    'Returns the room host gift total for backend host-dashboard requests.';
