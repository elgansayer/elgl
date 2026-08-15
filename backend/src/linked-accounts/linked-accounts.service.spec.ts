import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  LinkedAccountsService,
  LinkedAccount,
} from './linked-accounts.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('LinkedAccountsService', () => {
  let service: LinkedAccountsService;
  let supabaseService: Partial<SupabaseService>;

  const mockSupabaseChain = (methods: Record<string, Mock>) => {
    const chain: Record<string, Mock> = {};
    Object.entries(methods).forEach(([name, fn]) => {
      chain[name] = fn.mockReturnThis ? fn : fn;
    });
    return chain;
  };

  beforeEach(async () => {
    supabaseService = {
      getClient: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinkedAccountsService,
        { provide: SupabaseService, useValue: supabaseService },
      ],
    }).compile();

    service = module.get<LinkedAccountsService>(LinkedAccountsService);
  });

  describe('getLinkedAccounts', () => {
    it('should return mock fallback for seeded users when no DB data', async () => {
      const select = vi.fn().mockReturnThis();
      const eq = vi.fn().mockReturnThis();
      const order = vi.fn().mockResolvedValue({ data: [], error: null });
      (supabaseService.getClient as Mock).mockReturnValue({
        from: vi.fn().mockReturnValue({ select, eq, order }),
      });

      const result = await service.getLinkedAccounts('fake-5');
      expect(result).toHaveLength(3);
      expect(result[0].provider).toBe('google');
      expect(result.every((a) => a.active)).toBe(true);
    });

    it('should return empty array when no accounts exist', async () => {
      const select = vi.fn().mockReturnThis();
      const eq = vi.fn().mockReturnThis();
      const order = vi.fn().mockResolvedValue({ data: [], error: null });
      (supabaseService.getClient as Mock).mockReturnValue({
        from: vi.fn().mockReturnValue({ select, eq, order }),
      });

      const result = await service.getLinkedAccounts('user-1');
      expect(result).toEqual([]);
    });

    it('should return mapped accounts', async () => {
      const select = vi.fn().mockReturnThis();
      const eq = vi.fn().mockReturnThis();
      const order = vi.fn().mockResolvedValue({
        data: [
          {
            provider: 'google',
            name: 'test@gmail.com',
            active: true,
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
        error: null,
      });
      (supabaseService.getClient as Mock).mockReturnValue({
        from: vi.fn().mockReturnValue({ select, eq, order }),
      });

      const result = await service.getLinkedAccounts('user-1');
      expect(result).toEqual([
        {
          provider: 'google',
          name: 'test@gmail.com',
          active: true,
          created_at: '2024-01-01T00:00:00Z',
        },
      ]);
    });

    it('should return empty array on supabase error', async () => {
      const select = vi.fn().mockReturnThis();
      const eq = vi.fn().mockReturnThis();
      const order = vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'DB error' } });
      (supabaseService.getClient as vi.Mock).mockReturnValue({
        from: vi.fn().mockReturnValue({ select, eq, order }),
      });

      const result = await service.getLinkedAccounts('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('linkAccount', () => {
    it('should upsert an account', async () => {
      const upsert = vi.fn().mockResolvedValue({ error: null });
      (supabaseService.getClient as Mock).mockReturnValue({
        from: vi.fn().mockReturnValue({ upsert }),
      });

      await expect(
        service.linkAccount('user-1', 'google', 'test@gmail.com'),
      ).resolves.not.toThrow();
    });

    it('should throw on error', async () => {
      const upsert = vi
        .fn()
        .mockResolvedValue({ error: { message: 'DB error' } });
      (supabaseService.getClient as vi.Mock).mockReturnValue({
        from: vi.fn().mockReturnValue({ upsert }),
      });

      await expect(service.linkAccount('user-1', 'google')).rejects.toThrow(
        'Could not link account',
      );
    });
  });

  describe('unlinkAccount', () => {
    it('should delete an account', async () => {
      const deleteFn = vi.fn().mockReturnThis();
      const match = vi.fn().mockResolvedValue({ error: null });
      (supabaseService.getClient as Mock).mockReturnValue({
        from: vi.fn().mockReturnValue({ delete: deleteFn, match }),
      });

      await expect(
        service.unlinkAccount('user-1', 'google'),
      ).resolves.not.toThrow();
    });

    it('should throw on error', async () => {
      const deleteFn = vi.fn().mockReturnThis();
      const match = vi
        .fn()
        .mockResolvedValue({ error: { message: 'DB error' } });
      (supabaseService.getClient as vi.Mock).mockReturnValue({
        from: vi.fn().mockReturnValue({ delete: deleteFn, match }),
      });

      await expect(service.unlinkAccount('user-1', 'google')).rejects.toThrow(
        'Could not unlink account',
      );
    });
  });
});
