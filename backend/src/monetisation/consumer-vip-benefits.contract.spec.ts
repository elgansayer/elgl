import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const backendRoot = existsSync(resolve(process.cwd(), 'src/users/users.service.ts'))
  ? process.cwd()
  : resolve(process.cwd(), 'backend');

function source(path: string): string {
  return readFileSync(resolve(backendRoot, path), 'utf8');
}

describe('consumer VIP API benefit contract (#1363)', () => {
  const nlpService = source('src/nlp/nlp.service.ts');
  const aiConversationService = source(
    'src/ai-conversation/ai-conversation.service.ts',
  );
  const usersService = source('src/users/users.service.ts');
  const usersController = source('src/users/users.controller.ts');
  const profileVisitsService = source(
    'src/profile-visits/profile-visits.service.ts',
  );

  it('keeps daily AI usage capped for free users and unlimited for VIP users', () => {
    expect(nlpService).toContain('if (isVip) return;');
    expect(nlpService).toContain('currentCount >= 10');
    expect(nlpService).toContain('daily_ai_usage:${userId}:${today}');

    expect(aiConversationService).toContain('const DAILY_AI_LIMIT_FREE = 10;');
    expect(aiConversationService).toContain("const REDIS_KEY_PREFIX = 'daily_ai_usage:';");
    expect(aiConversationService).toContain('if (isVip) return true;');
  });

  it('keeps the free-tier target-language limit at one and consumer VIP at three', () => {
    expect(usersService).toContain(
      'dto.target_languages.length > 1 && !isVip',
    );
    expect(usersService).toContain('dto.target_languages.length > 3');
    expect(usersService).toContain(
      "tier === 'pro' || tier === 'developer' ? 5 : 3",
    );
  });

  it('keeps location spoofing behind the authoritative VIP entitlement', () => {
    expect(usersService).toContain('dto.mock_location !== undefined');
    expect(usersService).toContain('dto.mock_country !== undefined');
    expect(usersService).toContain('dto.mock_city !== undefined');
    expect(usersService).toContain('dto.enable_location_spoofing === true');
    expect(usersService).toContain('setsSpoofedLocation && !isVip');

    expect(usersController).toContain(
      '(await this.usersService.getProfile(user.id))?.is_vip ?? false',
    );
  });

  it('keeps incognito profile visits VIP-only and hides visitor identity for free owners', () => {
    expect(usersService).toContain('settings.incognito_visits && !isVip');
    expect(usersService).toContain(
      'updatePayload.incognito_visits = settings.incognito_visits',
    );
    expect(usersController).toContain(
      'this.usersService.updatePrivacySettings(user.id, dto, isVip)',
    );

    expect(profileVisitsService).toContain('if (isVipVisitor)');
    expect(profileVisitsService).toContain('if (user.incognito_visits)');
    expect(profileVisitsService).toContain(
      'return { incognito: true, ignored: true };',
    );
    expect(profileVisitsService).toContain('if (!isOwnerVip)');
    expect(profileVisitsService).toContain("id: 'hidden-vip-only'");
    expect(profileVisitsService).toContain('is_blurred: true');
  });
});
