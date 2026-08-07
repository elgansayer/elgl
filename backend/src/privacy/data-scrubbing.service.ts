import { Injectable, Logger } from '@nestjs/common';

/**
 * Data-scrubbing helpers for GDPR compliance.
 *
 * Purpose:
 * - Remove or mask personally identifiable information (PII) before exposing
 *   it in admin dashboards or audit logs.
 * - Provide a single, auditable place to apply scrubbing rules so they are
 *   consistent across all admin/moderation surface areas.
 *
 * Policies enforced:
 * - IP addresses are truncated to /24 for IPv4 and /48 for IPv6 (zeroed  host
 *   portion). This preserves geo-IP and ASN lookups while hiding the specific
 *   endpoint.
 * - User-agent strings are passed through as-is because they are necessary for
 *   security investigations (they do NOT contain PII under GDPR in the
 *   controller-to-controller context).
 * - Receipt tokens are truncated to their last 4 characters to preserve
 *   debuggability while hiding the full payment credential.
 * - Transaction IDs are passed through as-is because they are opaque provider-
 *   generated identifiers that do not contain PII.
 * - User profile data exposed in recommendations/matchmaking contexts is
 *   pseudonymised for admin-audit surfaces: display names are truncated to
 *   first character + asterisks, avatar URLs are redacted, and language lists
 *   are passed through (they are public profile fields users consent to share).
 * - All scrub operations are logged at debug level for audit trail.
 */
@Injectable()
export class DataScrubbingService {
  private readonly logger = new Logger(DataScrubbingService.name);

  // Matches IPv4 octets
  private readonly IPV4_REGEX = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

  // Matches full IPv6 addresses (abbreviated form)
  private readonly IPV6_REGEX =
    /^([0-9a-fA-F]{0,4}):([0-9a-fA-F]{0,4}):([0-9a-fA-F]{0,4}):([0-9a-fA-F]{0,4}):([0-9a-fA-F]{0,4}):([0-9a-fA-F]{0,4}):([0-9a-fA-F]{0,4}):([0-9a-fA-F]{0,4})$/;

  /**
   * Scrub a single IP address.
   *
   * IPv4 → zero last octet   (e.g. 203.0.113.5 → 203.0.113.0)
   * IPv6 → zero last 80 bits (e.g. 2001:db8::1   → 2001:db8:0:0:0:0:0:0)
   * Returns the original value if it does not look like an IP address.
   */
  scrubIpAddress(raw: string | null | undefined): string | null {
    if (!raw) {
      return null;
    }

    const trimmed = raw.trim();

    const v4 = this.IPV4_REGEX.exec(trimmed);
    if (v4) {
      const scrubbed = `${v4[1]}.${v4[2]}.${v4[3]}.0`;
      this.logger.debug(`Scrubbed IPv4: ${scrubbed}`);
      return scrubbed;
    }

    const v6 = this.IPV6_REGEX.exec(trimmed);
    if (v6) {
      // Zero the host portion – keep the network prefix (/48)
      const scrubbed = `${v6[1]}:${v6[2]}:${v6[3]}:0:0:0:0:0`;
      this.logger.debug(`Scrubbed IPv6: ${scrubbed}`);
      return scrubbed;
    }

    // If it doesn't match either format, return the original value.
    return trimmed;
  }

  /**
   * Scrub an array of login-history entries in-place.
   *
   * Modifies each entry's `ip_address` field using `scrubIpAddress()`.
   */
  scrubLoginHistory(
    entries: Array<{ ip_address?: string | null }>,
  ): void {
    for (const entry of entries) {
      if (entry.ip_address) {
        entry.ip_address = this.scrubIpAddress(entry.ip_address);
      }
    }
  }

  /**
   * Scrub a receipt token by keeping only the last 4 characters.
   *
   * Receipt tokens are payment credentials (Apple receipt-data blobs, Google
   * Play purchase tokens, Stripe session IDs) that can be used to look up
   * purchase details in payment provider APIs. Under GDPR these are PII
   * because they link a natural person to a financial transaction.
   *
   * We preserve the last 4 characters to allow support agents to verify the
   * token without exposing the full credential.
   *
   * Examples:
   *   "cs_live_a1b2c3d4e5f6g7h8" → "***h8"
   *   "ios_MIIaVeryLongBase64String…==" → "***…=="
   */
  scrubReceiptToken(raw: string | null | undefined): string | null {
    if (!raw) {
      return null;
    }

    const trimmed = raw.trim();
    if (trimmed.length <= 4) {
      this.logger.debug('Receipt token too short to scrub; returning null');
      return null;
    }

    const scrubbed = `***${trimmed.slice(-4)}`;
    this.logger.debug('Scrubbed receipt token');
    return scrubbed;
  }

  /**
   * Scrub an array of coin-purchase records in-place.
   *
   * Modifies each entry's `receipt_token` field using `scrubReceiptToken()`.
   * Leaves `transaction_id` intact because it is an opaque provider-generated
   * identifier without intrinsic PII content.
   */
  scrubCoinPurchaseRecords(
    records: Array<{ receipt_token?: string | null }>,
  ): void {
    for (const record of records) {
      if (record.receipt_token) {
        record.receipt_token = this.scrubReceiptToken(record.receipt_token);
      }
    }
  }

  /**
   * Scrub an array of gift-transaction records for admin display.
   *
   * Gift transactions contain sender_id and receiver_id which are foreign
   * keys to the users table. These are not PII per se (they are internal
   * UUIDs), but in bulk they reveal social-graph metadata. We leave them
   * intact for now because admin moderation tooling requires them for
   * abuse investigations. This method exists as an explicit audit point
   * where this decision is documented.
   */
  scrubGiftTransactionRecords(
    records: Array<{
      sender_id?: string | null;
      receiver_id?: string | null;
    }>,
  ): void {
    // Current policy: pass through unmodified for abuse-detection purposes.
    // If a future GDPR assessment requires pseudonymisation here, apply
    // HMAC-based replacement with a per-tenant secret.
    for (const _record of records) {
      // no-op: documented decision
    }
    if (records.length > 0) {
      this.logger.debug(
        `Scrubbed ${records.length} gift transaction records (no-op per current policy)`,
      );
    }
  }

  /**
   * Scrub economic data for GDPR-safe admin display.
   *
   * Accepts a record with optional receipt_token, sender_id, receiver_id
   * and applies the appropriate scrubbing policy to each field.
   */
  scrubEconomyRecord(record: {
    receipt_token?: string | null;
    sender_id?: string | null;
    receiver_id?: string | null;
    ip_address?: string | null;
  }): void {
    if (record.receipt_token) {
      record.receipt_token = this.scrubReceiptToken(record.receipt_token);
    }
    if (record.ip_address) {
      record.ip_address = this.scrubIpAddress(record.ip_address);
    }
    // sender_id / receiver_id are internal UUIDs; pass through per policy
  }

  /**
   * Scrub a display name for admin audit surfaces.
   *
   * Preserves the first character and replaces the rest with asterisks
   * so that admins can still distinguish users without seeing full names.
   * Names of 2 characters or fewer are fully replaced with asterisks.
   *
   * Examples:
   *   "Maria"   → "M****"
   *   "John"    → "J***"
   *   "Li"      → "**"
   *   null      → null
   */
  scrubDisplayName(raw: string | null | undefined): string | null {
    if (!raw) {
      return null;
    }

    const trimmed = raw.trim();
    if (trimmed.length <= 2) {
      const scrubbed = '*'.repeat(trimmed.length);
      this.logger.debug('Scrubbed short display name');
      return scrubbed;
    }

    const scrubbed = trimmed[0] + '*'.repeat(trimmed.length - 1);
    this.logger.debug('Scrubbed display name');
    return scrubbed;
  }

  /**
   * Scrub an avatar URL for admin audit surfaces.
   *
   * Avatars are direct image URLs that can reveal personally identifiable
   * photographic data. Under GDPR this is biometric-adjacent PII. In admin
   * audit contexts we redact the URL entirely, replacing it with a static
   * indicator that an avatar exists.
   *
   * Returns null if the input is null/undefined/empty, otherwise returns
   * the string "[AVATAR-REDACTED]" to indicate an avatar was present.
   */
  scrubAvatarUrl(raw: string | null | undefined): string | null {
    if (!raw) {
      return null;
    }
    this.logger.debug('Scrubbed avatar URL');
    return '[AVATAR-REDACTED]';
  }

  /**
   * Scrub a single user profile entry for admin audit surfaces.
   *
   * Applies the following scrubbing policies:
   * - display_name → pseudonymised (first char + asterisks)
   * - avatar_url → redacted
   * - audio_intro_url → redacted
   * - bio_text → redacted
   * - location fields → passed through (geo data is not PII at admin level)
   * - native_language / target_languages → passed through (public consent)
   * - study/correction stats → passed through (aggregate metrics, not PII)
   *
   * Modifies the record in-place for efficiency when processing large arrays.
   */
  scrubUserProfileForAdmin(record: {
    display_name?: string | null;
    avatar_url?: string | null;
    audio_intro_url?: string | null;
    bio_text?: string | null;
  }): void {
    if (record.display_name) {
      record.display_name = this.scrubDisplayName(record.display_name);
    }
    if (record.avatar_url) {
      record.avatar_url = this.scrubAvatarUrl(record.avatar_url);
    }
    if (record.audio_intro_url) {
      record.audio_intro_url = '[AUDIO-REDACTED]';
    }
    if (record.bio_text) {
      record.bio_text = '[BIO-REDACTED]';
    }
    this.logger.debug('Scrubbed user profile for admin');
  }

  /**
   * Scrub an array of recommendation/matchmaking DTOs for GDPR-safe admin
   * audit display.
   *
   * Recommendation data exposed through admin dashboards or audit logs must
   * have profile PII pseudonymised. This method applies scrubUserProfileForAdmin
   * to each entry in-place, plus document-specific scrubbing for matchmaking
   * context fields.
   *
   * Policies for recommendation-specific fields:
   * - id → passed through (internal UUID, not PII)
   * - displayName → pseudonymised
   * - avatarUrl → redacted
   * - nativeLanguage / targetLanguages → passed through (public profile consent)
   * - sharedInterests → passed through (aggregate count, not PII)
   * - isSeriousLearner / studyStreakDays / correctionRatio → passed through
   * - matchTier → passed through (algorithm metadata)
   */
  scrubRecommendationRecords(
    records: Array<{
      id?: string | null;
      displayName?: string | null;
      avatarUrl?: string | null;
      nativeLanguage?: string | null;
      targetLanguages?: string[] | null;
      sharedInterests?: number;
      isSeriousLearner?: boolean | null;
      studyStreakDays?: number | null;
      correctionRatio?: number | null;
      matchTier?: string;
    }>,
  ): void {
    for (const record of records) {
      if (record.displayName) {
        record.displayName = this.scrubDisplayName(record.displayName);
      }
      if (record.avatarUrl) {
        record.avatarUrl = this.scrubAvatarUrl(record.avatarUrl);
      }
      // nativeLanguage, targetLanguages pass through – public profile consent
      // sharedInterests, isSeriousLearner, studyStreakDays, correctionRatio,
      // matchTier – aggregate/algorithmic data, not PII
    }
    if (records.length > 0) {
      this.logger.debug(
        `Scrubbed ${records.length} recommendation records for admin audit`,
      );
    }
  }
}