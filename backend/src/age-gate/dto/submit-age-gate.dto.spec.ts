import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SubmitAgeGateDto } from './submit-age-gate.dto';

async function errorsFor(body: unknown) {
  return validate(plainToInstance(SubmitAgeGateDto, body));
}

describe('SubmitAgeGateDto', () => {
  it('accepts an ISO calendar date', async () => {
    expect(await errorsFor({ dateOfBirth: '1999-04-23' })).toHaveLength(0);
  });

  it.each([
    {},
    { dateOfBirth: null },
    { dateOfBirth: 19990423 },
    { dateOfBirth: '23/04/1999' },
    { dateOfBirth: '1999-4-23' },
    { dateOfBirth: '1999-04-23T00:00:00Z' },
    { dateOfBirth: '' },
  ])('rejects %j', async (body) => {
    const errors = await errorsFor(body);
    expect(errors.some((error) => error.property === 'dateOfBirth')).toBe(true);
  });
});
