import { validate } from 'class-validator';
import { RequestPasswordResetDto } from './request-password-reset.dto';

describe('RequestPasswordResetDto', () => {
  it('should pass validation with a valid email', async () => {
    const dto = new RequestPasswordResetDto();
    dto.email = 'user@example.com';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail validation with an invalid email', async () => {
    const dto = new RequestPasswordResetDto();
    dto.email = 'not-an-email';

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('email');
  });

  it('should fail validation with an empty email', async () => {
    const dto = new RequestPasswordResetDto();
    dto.email = '';

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });
});
