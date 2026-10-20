import { GoneException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { User } from '@supabase/supabase-js';
import { LinkedAccountsController } from './linked-accounts.controller';
import { LinkedAccountsService } from './linked-accounts.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

describe('LinkedAccountsController', () => {
  let controller: LinkedAccountsController;
  let service: { getLinkedAccounts: ReturnType<typeof vi.fn> };

  const user = { id: 'user-1' } as User;

  beforeEach(async () => {
    service = { getLinkedAccounts: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LinkedAccountsController],
      providers: [{ provide: LinkedAccountsService, useValue: service }],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<LinkedAccountsController>(LinkedAccountsController);
  });

  it('returns authoritative linked accounts for the authenticated user', async () => {
    const expected = [{ provider: 'google', active: true }];
    service.getLinkedAccounts.mockResolvedValue(expected);

    await expect(controller.getLinkedAccounts(user)).resolves.toEqual(expected);
    expect(service.getLinkedAccounts).toHaveBeenCalledWith('user-1');
  });

  it('fails closed for the legacy server-side link mutation endpoint', () => {
    expect(() => controller.linkAccount()).toThrow(GoneException);
  });

  it('fails closed for the legacy server-side unlink mutation endpoint', () => {
    expect(() => controller.unlinkAccount()).toThrow(GoneException);
  });
});
