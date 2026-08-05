import { Test, TestingModule } from '@nestjs/testing';
import { PasswordResetController } from './password-reset.controller';
import { PasswordResetService } from './password-reset.service';

describe('PasswordResetController', () => {
  let controller: PasswordResetController;
  let service: {
    requestPasswordReset: jest.Mock;
    resetPassword: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      requestPasswordReset: jest.fn(),
      resetPassword: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PasswordResetController],
      providers: [
        {
          provide: PasswordResetService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<PasswordResetController>(PasswordResetController);
  });

  describe('requestPasswordReset', () => {
    it('should call service and return success message', async () => {
      service.requestPasswordReset.mockResolvedValue(undefined);

      const dto = { email: 'user@example.com' };
      const result = await controller.requestPasswordReset(dto);

      expect(service.requestPasswordReset).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        message: 'If the email address exists, a reset link has been sent.',
      });
    });

    it('should handle emails that do not exist gracefully', async () => {
      service.requestPasswordReset.mockResolvedValue(undefined);

      const dto = { email: 'nonexistent@example.com' };
      const result = await controller.requestPasswordReset(dto);

      expect(service.requestPasswordReset).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        message: 'If the email address exists, a reset link has been sent.',
      });
    });
  });

  describe('resetPassword', () => {
    it('should call service and return success message', async () => {
      service.resetPassword.mockResolvedValue(undefined);

      const dto = { token: 'valid-token', newPassword: 'newPassword123' };
      const result = await controller.resetPassword(dto);

      expect(service.resetPassword).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ message: 'Password has been successfully reset.' });
    });

    it('should propagate errors from the service', async () => {
      service.resetPassword.mockRejectedValue(new Error('Invalid token'));

      const dto = { token: 'invalid-token', newPassword: 'newPassword123' };

      await expect(controller.resetPassword(dto)).rejects.toThrow('Invalid token');
    });
  });
});
