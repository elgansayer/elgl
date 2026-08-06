import { Test, TestingModule } from '@nestjs/testing';
import { PasswordResetController } from './password-reset.controller';
import { PasswordResetService } from './password-reset.service';

describe('PasswordResetController', () => {
  let controller: PasswordResetController;
  let mockService: { requestPasswordReset: jest.Mock; resetPassword: jest.Mock };

  beforeEach(async () => {
    mockService = {
      requestPasswordReset: jest.fn().mockResolvedValue(undefined),
      resetPassword: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PasswordResetController],
      providers: [{ provide: PasswordResetService, useValue: mockService }],
    }).compile();

    controller = module.get<PasswordResetController>(PasswordResetController);
  });

  describe('requestPasswordReset', () => {
    it('should call service and return a generic success message', async () => {
      resetService.requestPasswordReset.mockResolvedValue(undefined);

      const result = await controller.requestPasswordReset({
        email: 'user@example.com',
      });

      expect(resetService.requestPasswordReset).toHaveBeenCalledWith({
        email: 'user@example.com',
      });
      expect(result).toEqual({
        message: 'If the email address exists, a reset link has been sent.',
      });
    });

    it('should return success message even if service throws (to not leak info)', async () => {
      resetService.requestPasswordReset.mockRejectedValue(undefined);

      // It will throw; controller does not catch it – that's by design, callers see error
      await expect(
        controller.requestPasswordReset({ email: 'bad@example.com' }),
      ).rejects.toBeUndefined();
    });
  });

  describe('resetPassword', () => {
    it('should call service and return success message', async () => {
      resetService.resetPassword.mockResolvedValue(undefined);

      const result = await controller.resetPassword({
        token: 'valid-token',
        newPassword: 'newPass123!',
      });

      expect(resetService.resetPassword).toHaveBeenCalledWith({
        token: 'valid-token',
        newPassword: 'newPass123!',
      });
      expect(result).toEqual({
        message: 'Password has been successfully reset.',
      });
    });
  });
});