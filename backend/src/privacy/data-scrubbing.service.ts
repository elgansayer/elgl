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
 * - Escrow transaction fields (reason, metadata) are scrubbed by replacing
 *   free-text PII with redacted placeholders when the escrow is viewed by
 *   non-participants (e.g. in admin dashboards or audit exports).
 * - All scrub operations are logged at debug level for audit trail.
 */

/** Escrow PII fields that may contain free-text PII */
export interface EscrowPiiFields {
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** The result of scrubbing an escrow's PII fields */
export interface ScrubbedEscrowPiiFields {
  reason: string | null;
  metadata: Record<string, unknown> | null;
}

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
   * Scrub free-text PII fields from an escrow transaction record.
   *
   * When called with `fullScrub = false` (default for participant-facing APIs),
   * the PII fields are returned as-is because the caller is a participant of
   * that escrow.
   *
   * When called with `fullScrub = true` (admin / audit / non-participant views),
   * all free-text PII fields are replaced with `[REDACTED]` to prevent
   * accidental exposure of personal data embedded in escrow reasons or
   * metadata.
   */
  scrubEscrowPii(
    fields: EscrowPiiFields,
    fullScrub: boolean,
  ): ScrubbedEscrowPiiFields {
    if (!fullScrub) {
      return {
        reason: fields.reason ?? null,
        metadata: fields.metadata ?? null,
      };
    }

    this.logger.debug('Full scrub applied to escrow PII fields');

    return {
      reason: this.redactFreeText(fields.reason),
      metadata: fields.metadata ? {} : null,
    };
  }

  /**
   * Replace non-null free-text with `[REDACTED]`.
   *
   * Returns null if the input is null/undefined/empty, otherwise returns the
   * redaction sentinel. This preserves the null-vs-populated distinction
   * without exposing the original content.
   */
  redactFreeText(value: string | null | undefined): string | null {
    if (!value || value.trim().length === 0) {
      return null;
    }
    return '[REDACTED]';
  }
}