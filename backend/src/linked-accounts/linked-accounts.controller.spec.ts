import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { LinkedAccountsController } from './linked-accounts.controller';
import { LinkedAccountsService } from './linked-accounts.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

describe('LinkedAccountsController', () => {
  let controller: LinkedAccountsController;
  let service: {
    getLinkedAccounts: vi.Mock;
    linkAccount: vi.Mock;
    unlinkAccount: vi.Mock;
  };

  const mockRequest = (userId = 'user-1') =>
    ({
      user: { id: userId },
    }) as any;

  beforeEach(async () => {
    service = {
      getLinkedAccounts: vi.fn(),
      linkAccount: vi.fn(),
      unlinkAccount: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LinkedAccountsController],
      providers: [{ provide: LinkedAccountsService, useValue: service }],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<LinkedAccountsController>(LinkedAccountsController);
  });

  describe('getLinkedAccounts', () => {
    it('should return linked accounts for the authenticated user', async () => {
      const expected = [{ provider: 'google', active: true }];
      service.getLinkedAccounts.mockResolvedValue(expected);

      const result = await controller.getLinkedAccounts(mockRequest());
      expect(result).toEqual(expected);
      expect(service.getLinkedAccounts).toHaveBeenCalledWith('user-1');
    });
  });

  describe('linkAccount', () => {
    it('should link an account for the authenticated user', async () => {
      service.linkAccount.mockResolvedValue(undefined);

      const result = await controller.linkAccount(mockRequest(), {
        provider: 'google',
        name: 'test@gmail.com',
      });
      expect(result).toEqual({ success: true });
      expect(service.linkAccount).toHaveBeenCalledWith(
        'user-1',
        'google',
        'test@gmail.com',
      );
    });

    it('should link without a name', async () => {
      service.linkAccount.mockResolvedValue(undefined);

      const result = await controller.linkAccount(mockRequest(), {
        provider: 'facebook',
      });
      expect(result).toEqual({ success: true });
      expect(service.linkAccount).toHaveBeenCalledWith(
        'user-1',
        'facebook',
        undefined,
      );
    });
  });

  describe('unlinkAccount', () => {
    it('should unlink an account for the authenticated user', async () => {
      service.unlinkAccount.mockResolvedValue(undefined);

      const result = await controller.unlinkAccount(mockRequest(), {
        provider: 'google',
      });
      expect(result).toEqual({ success: true });
      expect(service.unlinkAccount).toHaveBeenCalledWith('user-1', 'google');
    });
  });
});
