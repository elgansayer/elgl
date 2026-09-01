import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';
import { SelectInterestsDto } from './dto/select-interests.dto';
import { InterestsController } from './interests.controller';

describe('InterestsController', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const legacyInterestId = '20000000-0000-4000-8000-000000000002';

  function createController() {
    const service = {
      resolveLegacyInterestIds: vi.fn().mockResolvedValue(['travel']),
      setUserInterests: vi.fn().mockResolvedValue(undefined),
      generateFlashcards: vi.fn().mockResolvedValue(undefined),
    };
    return {
      controller: new InterestsController(service as never),
      service,
    };
  }

  it('stores a validated canonical tag body', async () => {
    const body = plainToInstance(SelectInterestsDto, {
      interestTags: ['travel'],
    });
    await expect(validate(body)).resolves.toHaveLength(0);
    const { controller, service } = createController();

    await controller.selectInterests(body, {
      user: { id: userId, target_languages: ['es'] },
    } as never);

    expect(service.resolveLegacyInterestIds).not.toHaveBeenCalled();
    expect(service.setUserInterests).toHaveBeenCalledWith(userId, ['travel']);
    expect(service.generateFlashcards).toHaveBeenCalledWith(userId, 'es');
  });

  it('translates a validated legacy UUID body before storage', async () => {
    const body = plainToInstance(SelectInterestsDto, {
      interestIds: [legacyInterestId],
    });
    await expect(validate(body)).resolves.toHaveLength(0);
    const { controller, service } = createController();

    await controller.selectInterests(body, {
      user: { id: userId, target_languages: ['es'] },
    } as never);

    expect(service.resolveLegacyInterestIds).toHaveBeenCalledWith([
      legacyInterestId,
    ]);
    expect(service.setUserInterests).toHaveBeenCalledWith(userId, ['travel']);
  });

  it.each([
    { interestTags: ['travel', 'travel'] },
    { interestTags: [' padded'] },
    { interestTags: ['x'.repeat(256)] },
    { interestTags: [42] },
    { interestIds: ['not-a-uuid'] },
  ])('rejects an unsafe selection before mutation: %j', async (input) => {
    const body = plainToInstance(SelectInterestsDto, input);
    await expect(validate(body)).resolves.not.toHaveLength(0);
  });
});
