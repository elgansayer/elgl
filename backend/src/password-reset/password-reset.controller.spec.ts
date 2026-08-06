import { Test, TestingModule } from '@nestjs/testing';
import { PasswordResetController } from './password-reset.controller';
import { PasswordResetService } from './password-reset.service';

describe('PasswordResetController', () => {
  let controller: PasswordResetController;
  let service: { requestPasswordReset: jest.Mock; resetPassword: jest.Mock };

  beforeEach(async () => {
    service = {
      requestPasswordReset: jest.fn(),
      resetPassword: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PasswordResetController],
      providers: [{ provide: PasswordResetService, useValue: service }],
    }).compile();

    controller = module.get<PasswordResetController>(PasswordResetController);
  });

  describe('requestPasswordReset', () => {
    it('should return generic success message regardless of email existence', async () => {
      service.requestPasswordReset.mockResolvedValue(undefined);

      const result = await controller.requestPasswordReset({
        email: 'user@example.com',
      });

      expect(result).toEqual({
        message: 'If the email address exists, a reset link has been sent.',
      });
      expect(service.requestPasswordReset).toHaveBeenCalledWith({
        email: 'user@example.com',
      });
    });
  });

  describe('resetPassword', () => {
    it('should return success message on valid reset', async () => {
      service.resetPassword.mockResolvedValue(undefined);

      const result = await controller.resetPassword({
        token: 'valid-token',
        newPassword: 'newPass123!',
      });

      expect(result).toEqual({
        message: 'Password has been successfully reset.',
      });
      expect(service.resetPassword).toHaveBeenCalledWith({
        token: 'valid-token',
        newPassword: 'newPass123!',
      });
    });
  });
});