import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { TranslateUiDto, UI_DICTIONARY_LIMITS } from './dto/translate-ui.dto';
import { NlpController } from './nlp.controller';
import { NlpRateLimiterGuard } from './nlp-rate-limiter.guard';

const THROTTLER_LIMIT = 'THROTTLER:LIMIT';
const THROTTLER_TTL = 'THROTTLER:TTL';

const repoRoot = existsSync(resolve(process.cwd(), 'backend', 'package.json'))
  ? process.cwd()
  : resolve(process.cwd(), '..');

function source(path: string): string {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

describe('interface translation product contract', () => {
  describe('POST /nlp/translate-ui', () => {
    it('is authenticated and rate limited per user at controller level', () => {
      const guards: unknown = Reflect.getMetadata(
        GUARDS_METADATA,
        NlpController,
      );

      expect(guards).toEqual([SupabaseAuthGuard, NlpRateLimiterGuard]);
    });

    it('is throttled because a cache miss can trigger paid provider calls', () => {
      const handler = NlpController.prototype.translateUi;

      expect(Reflect.getMetadata(`${THROTTLER_LIMIT}default`, handler)).toBe(
        30,
      );
      expect(Reflect.getMetadata(`${THROTTLER_TTL}default`, handler)).toBe(
        60000,
      );
    });
  });

  describe('browser and API agree on the request', () => {
    const client = source('frontend/src/app/services/i18n.service.ts');

    it('never sends more entries in one request than the API accepts', () => {
      const declared = /export const UI_TRANSLATION_BATCH_SIZE = (\d+);/.exec(
        client,
      );

      expect(declared).not.toBeNull();
      const batchSize = Number(declared?.[1]);
      expect(batchSize).toBeGreaterThan(0);
      expect(batchSize).toBeLessThanOrEqual(UI_DICTIONARY_LIMITS.maxEntries);
    });

    it('posts the whitelisted fields to the translate-ui route', () => {
      expect(client).toContain('`${environment.apiUrl}/nlp/translate-ui`');
      expect(client).toContain('target_language: code,');
      expect(client).toContain('dictionary: Object.fromEntries(batch),');

      const body = plainToInstance(TranslateUiDto, {
        target_language: 'sw',
        dictionary: { 'app.title': 'HelloTalk' },
      });
      expect(validateSync(body, { forbidNonWhitelisted: true })).toEqual([]);
    });

    it('sends the access token as a bearer credential', () => {
      expect(client).toContain('Authorization: `Bearer ${token}`');
    });
  });
});
