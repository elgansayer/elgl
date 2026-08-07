/**
 * Redis cache key constants, TTLs, and invalidation rules for the
 * Virtual Coin Economy.
 *
 * Cache-Aside Strategy:
 *  1. Cache reads check Redis first, fall back to database, then populate cache.
 *  2. Cache writes (invalidation) happen AFTER every database mutation that
 *     modifies coin balances, the gift catalog, or sticker pack ownership.
 *  3. Cross-service mutations (monetisation, escrow, audio-rooms, language-
 *     challenges, shopping, apple-notification, admin) invalidate user balance
 *     caches via `invalidateUserBalanceCache()`.
 */

export const ECONOMY_CACHE_KEYS = {
  /** Virtual gift catalog: cached as JSON array of VirtualGiftRow */
  GIFT_CATALOG: 'economy:gift_catalog',

  /** Coin packages: cached as JSON array of CoinPackage */
  COIN_PACKAGES: 'economy:coin_packages',

  /** User coin balance: per-user key, pattern economy:balance:{userId} */
  USER_BALANCE: (userId: string) => `economy:balance:${userId}`,
  USER_BALANCE_PATTERN: 'economy:balance:*',

  /** Sticker pack storefront: per-user key, pattern economy:sticker_packs:{userId} */
  STICKER_PACKS: (userId: string) => `economy:sticker_packs:${userId}`,
  STICKER_PACKS_PATTERN: 'economy:sticker_packs:*',

  /** Daily check-in: per-user-per-day key, pattern daily_checkin:{userId}:{date} */
  DAILY_CHECKIN: (userId: string, date: string) =>
    `daily_checkin:${userId}:${date}`,
} as const;

export const ECONOMY_CACHE_TTL = {
  /** Gift catalog: 1 hour (changes rarely, only when admin adds/removes gifts) */
  GIFT_CATALOG: 3600,

  /** Coin packages: 1 hour (changes only with app updates) */
  COIN_PACKAGES: 3600,

  /** User balance: 5 minutes (balances change frequently) */
  USER_BALANCE: 300,

  /** Sticker pack storefront: 5 minutes (ownership can change) */
  STICKER_PACKS: 300,

  /** Daily check-in: 24 hours (one claim per day) */
  DAILY_CHECKIN: 86400,
} as const;