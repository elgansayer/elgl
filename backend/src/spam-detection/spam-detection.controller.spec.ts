import { GUARDS_METADATA } from '@nestjs/common/constants';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SpamDetectionController } from './spam-detection.controller';
import { SpamDetectionService } from './spam-detection.service';

describe('SpamDetectionController', () => {
  const service = {
    isSpam: vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true),
  };
  const controller = new SpamDetectionController(
    service as unknown as SpamDetectionService,
  );

  it('requires an authenticated session', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, SpamDetectionController),
    ).toContain(SupabaseAuthGuard);
  });

  it('returns the spam verdict for the submitted content', () => {
    expect(controller.check({ content: 'hello there' })).toEqual({
      isSpam: false,
    });
    expect(controller.check({ content: 'spam spam spam' })).toEqual({
      isSpam: true,
    });
    expect(service.isSpam).toHaveBeenCalledWith('hello there');
  });
});
