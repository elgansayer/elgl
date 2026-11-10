import { validate } from 'class-validator';
import { RateCorrectorDto } from './rate-corrector.dto';

describe('RateCorrectorDto', () => {
  function dto(ratedUserId: string, score: number): RateCorrectorDto {
    const value = new RateCorrectorDto();
    value.rated_user_id = ratedUserId;
    value.score = score;
    return value;
  }

  it('accepts a UUID target and an integer score from one to five', async () => {
    await expect(
      validate(dto('11111111-1111-4111-8111-111111111111', 5)),
    ).resolves.toHaveLength(0);
  });

  it.each([0, 4.5, 6])('rejects an invalid score: %s', async (score) => {
    await expect(
      validate(dto('11111111-1111-4111-8111-111111111111', score)),
    ).resolves.not.toHaveLength(0);
  });

  it('rejects a non-UUID target', async () => {
    await expect(validate(dto('not-a-user', 4))).resolves.not.toHaveLength(0);
  });
});
