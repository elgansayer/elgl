import { User } from '@supabase/supabase-js';
import { UsersService } from '../users/users.service';
import { GrammarCheckService } from './grammar-check.service';
import { GrammarExplanationService } from './grammar-explanation.service';
import { NlpController } from './nlp.controller';
import { NlpService } from './nlp.service';

describe('NlpController explainGrammar', () => {
  let checkRateLimit: ReturnType<typeof vi.fn>;
  let getProfile: ReturnType<typeof vi.fn>;
  let explain: ReturnType<typeof vi.fn>;
  let controller: NlpController;

  beforeEach(() => {
    checkRateLimit = vi.fn().mockResolvedValue(undefined);
    getProfile = vi.fn().mockResolvedValue({ is_vip: false });
    explain = vi.fn().mockResolvedValue({
      original: 'I go.',
      corrected: 'I went.',
      explanation: 'Use the past tense.',
    });

    controller = new NlpController(
      { checkRateLimit } as unknown as NlpService,
      { getProfile } as unknown as UsersService,
      {} as unknown as GrammarCheckService,
      { explain } as unknown as GrammarExplanationService,
    );
  });

  it('applies the existing daily AI allowance before requesting an explanation', async () => {
    const user = { id: 'user-123' } as User;
    const dto = { original: 'I go.', corrected: 'I went.' };

    await expect(controller.explainGrammar(user, dto)).resolves.toEqual({
      original: 'I go.',
      corrected: 'I went.',
      explanation: 'Use the past tense.',
    });

    expect(getProfile).toHaveBeenCalledWith('user-123');
    expect(checkRateLimit).toHaveBeenCalledWith('user-123', false);
    expect(explain).toHaveBeenCalledWith(dto);
    expect(checkRateLimit.mock.invocationCallOrder[0]).toBeLessThan(
      explain.mock.invocationCallOrder[0],
    );
  });

  it('preserves VIP daily-limit bypass semantics', async () => {
    getProfile.mockResolvedValue({ is_vip: true });

    await controller.explainGrammar({ id: 'vip-user' } as User, {
      original: 'I go.',
      corrected: 'I went.',
    });

    expect(checkRateLimit).toHaveBeenCalledWith('vip-user', true);
  });

  it('does not invoke profile, quota, or provider work without an authenticated user', async () => {
    await expect(
      controller.explainGrammar(null, {
        original: 'I go.',
        corrected: 'I went.',
      }),
    ).resolves.toBeNull();

    expect(getProfile).not.toHaveBeenCalled();
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(explain).not.toHaveBeenCalled();
  });
});
