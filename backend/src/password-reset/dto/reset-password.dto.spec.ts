import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ResetPasswordDto } from './reset-password.dto';

const VALID_TOKEN = 'a'.repeat(64);

describe('ResetPasswordDto', () => {
  it('passes validation with a generated reset token and bounded password', async () => {
    const dto = plainToInstance(ResetPasswordDto, {
      token: `  ${VALID_TOKEN}  `,
      newPassword: 'newPass123!',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.token).toBe(VALID_TOKEN);
  });

  it('rejects empty or malformed reset tokens', async () => {
    for (const token of ['', 'abc123', 'g'.repeat(64), 'a'.repeat(65)]) {
      const dto = plainToInstance(ResetPasswordDto, {
        token,
        newPassword: 'newPass123!',
      });
      const errors = await validate(dto);
      expect(errors.some((error) => error.property === 'token')).toBe(true);
    }
  });

  it('rejects passwords shorter than 8 characters', async () => {
    const dto = plainToInstance(ResetPasswordDto, {
      token: VALID_TOKEN,
      newPassword: 'short',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'newPassword')).toBe(true);
  });

  it('rejects passwords longer than 128 characters', async () => {
    const dto = plainToInstance(ResetPasswordDto, {
      token: VALID_TOKEN,
      newPassword: 'x'.repeat(129),
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'newPassword')).toBe(true);
  });
});
