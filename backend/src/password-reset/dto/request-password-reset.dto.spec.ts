import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RequestPasswordResetDto } from './request-password-reset.dto';

describe('RequestPasswordResetDto', () => {
  it('normalizes and validates a bounded email address', async () => {
    const dto = plainToInstance(RequestPasswordResetDto, {
      email: '  User@Example.COM  ',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.email).toBe('user@example.com');
  });

  it('rejects an invalid email', async () => {
    const dto = plainToInstance(RequestPasswordResetDto, {
      email: 'not-an-email',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'email')).toBe(true);
  });

  it('rejects an empty email', async () => {
    const dto = plainToInstance(RequestPasswordResetDto, { email: '   ' });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'email')).toBe(true);
  });

  it('rejects email input above the RFC mailbox length bound', async () => {
    const dto = plainToInstance(RequestPasswordResetDto, {
      email: `${'a'.repeat(245)}@example.com`,
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'email')).toBe(true);
  });
});
