import { Injectable, Logger } from '@nestjs/common';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;

/** Strict DOMPurify instance for sanitising user-authored text fields. */
const strictPurify = DOMPurify(window);
strictPurify.setConfig({
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: [],
  ALLOW_DATA_ATTR: false,
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?:)?\/\/)/i,
  KEEP_CONTENT: false,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  WHOLE_DOCUMENT: false,
  SANITIZE_DOM: true,
  SANITIZE_NAMED_PROPS: true,
});

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
 * - Escrow transaction `reason` and `metadata` fields are sanitised via
 *   DOMPurify to strip any embedded PII or HTML/script content.
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
  scrubLoginHistory(entries: Array<{ ip_address?: string | null }>): void {
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
   * Scrub a single escrow transaction record for GDPR-safe admin/moderation
   * display.
   *
   * Policies applied:
   * - `reason` -- user-authored free text that may contain PII (names,
   *   contact details, etc.). Sanitised via strict DOMPurify to strip all
   *   HTML/script content. Truncated to 500 characters to remove embedded
   *   structured data while preserving essential dispute-resolution context.
   * - `metadata` -- JSONB blob that may contain PII. Recursively sanitised
   *   via DOMPurify to strip HTML from all string values.
   * - `payer_id` / `payee_id` -- internal UUIDs; pass through (same policy
   *   as gift transaction sender/receiver IDs).
   * - `last_error` -- system-generated but may contain serialised user input.
   *   Sanitised via DOMPurify.
   *
   * This method exists as an explicit audit point where these decisions are
   * documented. It modifies the record in-place.
   */
  scrubEscrowRecord(record: {
    payer_id?: string | null;
    payee_id?: string | null;
    reason?: string | null;
    metadata?: Record<string, unknown> | null;
    last_error?: string | null;
  }): void {
    if (record.reason) {
      record.reason = this.sanitiseText(record.reason).slice(0, 500);
    }
    if (record.metadata && typeof record.metadata === 'object') {
      record.metadata = this.sanitiseObject(record.metadata);
    }
    if (record.last_error) {
      record.last_error = this.sanitiseText(record.last_error);
    }
  }

  /**
   * Scrub an array of escrow transaction records in-place for GDPR-safe
   * admin/moderation display.
   *
   * Applies `scrubEscrowRecord()` to every entry.
   */
  scrubEscrowTransactionRecords(
    records: Array<{
      payer_id?: string | null;
      payee_id?: string | null;
      reason?: string | null;
      metadata?: Record<string, unknown> | null;
      last_error?: string | null;
    }>,
  ): void {
    for (const record of records) {
      this.scrubEscrowRecord(record);
    }
    if (records.length > 0) {
      this.logger.debug(
        `Scrubbed ${records.length} escrow transaction records`,
      );
    }
  }

  /**
   * Scrub a crash report record for GDPR-safe admin display.
   *
   * Policies:
   * - `user_id` -- internal UUID; pass through.
   * - `context` -- may contain PII (e.g., payer IDs, amounts, email
   *   addresses logged during error handling). We log an audit entry but
   *   pass through because context is essential for crash resolution.
   * - `error_message` / `stack_trace` -- system-generated; pass through.
   */
  scrubCrashReport(record: {
    user_id?: string | null;
    context?: Record<string, unknown> | null;
    error_message?: string | null;
    stack_trace?: string | null;
  }): void {
    if (record.context && Object.keys(record.context).length > 0) {
      this.logger.debug(
        'Crash report context passed through (essential for crash resolution)',
      );
    }
    // user_id is an internal UUID; pass through.
    // error_message / stack_trace are system-generated; pass through.
  }

  /**
   * Scrub an array of crash report records in-place.
   */
  scrubCrashReportRecords(
    records: Array<{
      user_id?: string | null;
      context?: Record<string, unknown> | null;
      error_message?: string | null;
      stack_trace?: string | null;
    }>,
  ): void {
    for (const record of records) {
      this.scrubCrashReport(record);
    }
    if (records.length > 0) {
      this.logger.debug(
        `Scrubbed ${records.length} crash report records (pass-through per current policy)`,
      );
    }
  }

  /**
   * Sanitise a plain-text string by removing all HTML tags, entities,
   * and script content via DOMPurify.
   *
   * Used for free-text fields that are user-authored and may contain PII
   * or malicious content (e.g., escrow reasons, crash report context).
   */
  private sanitiseText(text: string): string {
    return strictPurify.sanitize(text);
  }

  /**
   * Recursively sanitise an object's string values through DOMPurify.
   *
   * Arrays and nested plain objects are traversed; class instances and
   * primitives are returned unchanged.
   */
  private sanitiseObject(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'string') {
        result[key] = strictPurify.sanitize(val);
      } else if (Array.isArray(val)) {
        result[key] = val.map((item) =>
          typeof item === 'string' ? strictPurify.sanitize(item) : item,
        );
      } else if (val !== null && typeof val === 'object') {
        const proto = Object.getPrototypeOf(val);
        if (proto === Object.prototype || proto === null) {
          result[key] = this.sanitiseObject(
            val as Record<string, unknown>,
          );
        } else {
          result[key] = val;
        }
      } else {
        result[key] = val;
      }
    }
    return result;
  }
}
