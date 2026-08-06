import { validate } from 'class-validator';
import { ResetPasswordDto } from './reset-password.dto';

describe('ResetPasswordDto', () => {
  it('should pass validation with valid token and password', async () => {
    const dto = new ResetPasswordDto();
    dto.token = 'abc123';
    dto.newPassword = 'newPass123!';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail validation when token is empty', async () => {
    const dto = new ResetPasswordDto();
    dto.token = '';
    dto.newPassword = 'newPass123!';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'token')).toBe(true);
  });

  it('should fail validation when newPassword is shorter than 8 characters', async () => {
    const dto = new ResetPasswordDto();
    dto.token = 'abc123';
    dto.newPassword = 'short';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'newPassword')).toBe(true);
  });
});
