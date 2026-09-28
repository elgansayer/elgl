import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { GrammarCheckDto } from './dto/grammar-check.dto';

const repoRoot = existsSync(resolve(process.cwd(), 'backend', 'package.json'))
  ? process.cwd()
  : resolve(process.cwd(), '..');

function source(path: string): string {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

function methodWindow(contents: string, marker: string): string {
  const start = contents.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  return contents.slice(start, start + 12000);
}

describe('AI grammar checker pre-send product contract', () => {
  it('keeps POST /nlp/grammar-check authenticated, bounded, rate-limited and no-store', () => {
    const controller = source('backend/src/nlp/nlp.controller.ts');

    expect(controller).toContain("@Controller('nlp')");
    expect(controller).toContain(
      '@UseGuards(SupabaseAuthGuard, NlpRateLimiterGuard)',
    );

    const grammarEndpoint = methodWindow(controller, "@Post('grammar-check')");
    expect(grammarEndpoint).toContain(
      '@Throttle({ default: { limit: 20, ttl: 60000 } })',
    );
    expect(grammarEndpoint).toContain(
      '@NlpRateLimit({ maxRequests: 20, windowSeconds: 60 })',
    );
    expect(grammarEndpoint).toContain(
      '@UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))',
    );
    expect(grammarEndpoint).toContain(
      'await this.nlpService.checkRateLimit(user.id, profile?.is_vip ?? false)',
    );
    expect(grammarEndpoint).toContain(
      'return await this.grammarCheckService.check(dto)',
    );
  });

  it('validates grammar-check text and BCP 47-style language input', () => {
    const valid = plainToInstance(GrammarCheckDto, {
      text: '  I went to school yesterday.  ',
      language: 'en-GB',
    });
    expect(validateSync(valid)).toHaveLength(0);
    expect(valid.text).toBe('I went to school yesterday.');

    const empty = plainToInstance(GrammarCheckDto, { text: '   ' });
    expect(validateSync(empty).length).toBeGreaterThan(0);

    const oversized = plainToInstance(GrammarCheckDto, {
      text: 'x'.repeat(2001),
    });
    expect(validateSync(oversized).length).toBeGreaterThan(0);

    const invalidLanguage = plainToInstance(GrammarCheckDto, {
      text: 'Hello',
      language: '../private',
    });
    expect(validateSync(invalidLanguage).length).toBeGreaterThan(0);
  });

  it('checks chat text before the authenticated send path and waits for suggestion review', () => {
    const chat = source(
      'frontend/src/app/components/chat-room/chat-room.component.ts',
    );
    const sendMethod = methodWindow(chat, 'async sendTextMessage');
    const grammarIndex = sendMethod.indexOf('this.vocabStore.checkGrammar');
    const sendIndex = sendMethod.indexOf('this.chatService.sendMessage');

    expect(grammarIndex).toBeGreaterThanOrEqual(0);
    expect(sendIndex).toBeGreaterThan(grammarIndex);
    expect(sendMethod).toContain('this.isCheckingGrammar.set(true)');

    const regression = source(
      'frontend/src/app/components/chat-room/chat-room.grammar-check.spec.ts',
    );
    expect(regression).toContain(
      'replaces the composer text with a suggestion and waits for user review',
    );
    expect(regression).toContain(
      'prevents duplicate grammar checks while a submission is already being reviewed',
    );
    expect(regression).toContain(
      'keeps sending available when the advisory checker degrades without a suggestion',
    );
  });

  it('checks Moment text before publish while leaving media-only posts provider-free', () => {
    const moments = source(
      'frontend/src/app/components/moments-feed/moments-feed.component.ts',
    );
    const submitMethod = methodWindow(moments, 'async submitMoment');
    const grammarIndex = submitMethod.indexOf('this.vocabStore.checkGrammar');
    const publishIndex = submitMethod.indexOf('this.momentsStore.createMoment');

    expect(grammarIndex).toBeGreaterThanOrEqual(0);
    expect(publishIndex).toBeGreaterThan(grammarIndex);
    expect(submitMethod).toContain('if (text)');
    expect(submitMethod).toContain('this.saveMomentDraft()');

    const regression = source(
      'frontend/src/app/components/moments-feed/moments-feed.grammar-check.spec.ts',
    );
    expect(regression).toContain(
      'replaces the draft with a suggestion and does not publish on the first submit',
    );
    expect(regression).toContain(
      'does not block publishing when the advisory checker degrades without a suggestion',
    );
    expect(regression).toContain(
      'keeps the existing media-only publish path free of unnecessary grammar calls',
    );
  });
});
