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
    it('should return a generic message regardless of email validity', async () => {
      const result = await controller.requestPasswordReset({ email: 'test@test.com' });
      expect(result).toEqual({
        message: 'If the email address exists, a reset link has been sent.',
      });
      expect(mockService.requestPasswordReset).toHaveBeenCalledWith({ email: 'test@test.com' });
    });
  });

  describe('resetPassword', () => {
    it('should return success message on password reset', async () => {
      const result = await controller.resetPassword({
        token: 'valid-token',
        newPassword: 'newpass123',
      });
      expect(result).toEqual({
        message: 'Password has been successfully reset.',
      });
      expect(mockService.resetPassword).toHaveBeenCalledWith({
        token: 'valid-token',
        newPassword: 'newpass123',
      });
    });
  });
});