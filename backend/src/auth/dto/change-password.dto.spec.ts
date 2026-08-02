import { validate } from 'class-validator';
import { ChangePasswordDto } from './change-password.dto';

describe('ChangePasswordDto', () => {
  it('should accept a valid DTO', async () => {
    const dto = new ChangePasswordDto();
    dto.currentPassword = 'oldPassword1';
    dto.newPassword = 'newPassword1';

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should fail when currentPassword is missing', async () => {
    const dto = new ChangePasswordDto();
    dto.newPassword = 'newPassword1';

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const currentPasswordError = errors.find(
      (error) => error.property === 'currentPassword',
    );
    expect(currentPasswordError).toBeDefined();
  });

  it('should fail when currentPassword is empty', async () => {
    const dto = new ChangePasswordDto();
    dto.currentPassword = '';
    dto.newPassword = 'newPassword1';

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const currentPasswordError = errors.find(
      (error) => error.property === 'currentPassword',
    );
    expect(currentPasswordError).toBeDefined();
  });

  it('should fail when currentPassword is not a string', async () => {
    const dto = new ChangePasswordDto();
    dto.currentPassword = 12345678 as unknown as string;
    dto.newPassword = 'newPassword1';

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const currentPasswordError = errors.find(
      (error) => error.property === 'currentPassword',
    );
    expect(currentPasswordError).toBeDefined();
  });

  it('should fail when newPassword is missing', async () => {
    const dto = new ChangePasswordDto();
    dto.currentPassword = 'oldPassword1';

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const newPasswordError = errors.find(
      (error) => error.property === 'newPassword',
    );
    expect(newPasswordError).toBeDefined();
  });

  it('should fail when newPassword is shorter than 8 characters', async () => {
    const dto = new ChangePasswordDto();
    dto.currentPassword = 'oldPassword1';
    dto.newPassword = 'short1';

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const newPasswordError = errors.find(
      (error) => error.property === 'newPassword',
    );
    expect(newPasswordError).toBeDefined();
  });

  it('should fail when newPassword is not a string', async () => {
    const dto = new ChangePasswordDto();
    dto.currentPassword = 'oldPassword1';
    dto.newPassword = 12345678 as unknown as string;

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const newPasswordError = errors.find(
      (error) => error.property === 'newPassword',
    );
    expect(newPasswordError).toBeDefined();
  });
});
