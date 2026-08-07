import { Injectable, Logger } from '@nestjs/common';
import { DataScrubbingResult } from './interfaces/escrow.interface';

interface RedactionRule {
  fieldPath: string;
  replacementValue: string;
}

const ESCROW_REDACTION_RULES: RedactionRule[] = [
  { fieldPath: 'transaction_subject', replacementValue: '[REDACTED]' },
  { fieldPath: 'description', replacementValue: '[REDACTED]' },
  { fieldPath: 'release_note', replacementValue: '[REDACTED]' },
  { fieldPath: 'reason', replacementValue: '[REDACTED]' },
  { fieldPath: 'evidence_description', replacementValue: '[REDACTED]' },
  { fieldPath: 'resolution_note', replacementValue: '[REDACTED]' },
];

interface PersonalDataSummary {
  hasPii: boolean;
  piiFields: string[];
}

@Injectable()
export class GdprDataScrubbingService {
  private readonly logger = new Logger(GdprDataScrubbingService.name);

  private static readonly PII_PATTERNS: ReadonlyArray<{
    name: string;
    regex: RegExp;
  }> = [
    { name: 'EMAIL', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
    { name: 'CREDIT_CARD', regex: /\b(?:\d[ -]*?){13,19}\b/g },
    { name: 'SSN', regex: /\b\d{3}-\d{2}-\d{4}\b/g },
    {
      name: 'PHONE',
      regex: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,9}/g,
    },
    { name: 'IP_ADDRESS', regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
    { name: 'STRIPE_PI', regex: /\bpi_[a-zA-Z0-9]+\b/g },
    { name: 'STRIPE_CH', regex: /\bch_[a-zA-Z0-9]+\b/g },
  ];

  scrubFreeText(text: string): string {
    if (!text) return text;

    let scrubbed = text;
    for (const pattern of GdprDataScrubbingService.PII_PATTERNS) {
      scrubbed = scrubbed.replace(pattern.regex, `[${pattern.name}]`);
    }
    return scrubbed;
  }

  detectPii(text: string): PersonalDataSummary {
    if (!text) return { hasPii: false, piiFields: [] };

    const piiFields: string[] = [];
    for (const pattern of GdprDataScrubbingService.PII_PATTERNS) {
      const matches = text.match(pattern.regex);
      if (matches && matches.length > 0) {
        piiFields.push(pattern.name);
      }
    }
    return { hasPii: piiFields.length > 0, piiFields };
  }

  scrubTransactionData(data: Record<string, unknown>): {
    scrubbed: Record<string, unknown>;
    result: DataScrubbingResult;
  } {
    const scrubbed = { ...data };
    const scrubbedFields: string[] = [];

    for (const rule of ESCROW_REDACTION_RULES) {
      if (
        scrubbed[rule.fieldPath] !== undefined &&
        scrubbed[rule.fieldPath] !== null
      ) {
        const originalValue = String(scrubbed[rule.fieldPath]);

        let cleaned = originalValue;
        for (const pattern of GdprDataScrubbingService.PII_PATTERNS) {
          cleaned = cleaned.replace(pattern.regex, `[${pattern.name}]`);
        }

        scrubbed[rule.fieldPath] = cleaned;
        scrubbedFields.push(rule.fieldPath);
      }
    }

    scrubbed['is_data_scrubbed'] = true;
    scrubbed['gdpr_scrubbed_at'] = new Date().toISOString();

    const txId = typeof data['id'] === 'string' ? data['id'] : 'unknown';

    const result: DataScrubbingResult = {
      transaction_id: txId,
      scrubbed_fields: scrubbedFields,
      performed_at: new Date().toISOString(),
    };

    return { scrubbed, result };
  }

  calculateRetentionDate(completionDate?: Date): Date {
    const base = completionDate || new Date();
    const retention = new Date(base);
    retention.setFullYear(retention.getFullYear() + 7);
    return retention;
  }

  isRetentionExpired(retentionDate: string): boolean {
    return new Date(retentionDate) <= new Date();
  }

  logScrubbingEvent(transactionId: string, result: DataScrubbingResult): void {
    this.logger.log(
      `GDPR scrubbing performed on transaction ${transactionId}: ` +
        `${result.scrubbed_fields.length} fields scrubbed ` +
        `(${result.scrubbed_fields.join(', ')})`,
    );
  }
}
