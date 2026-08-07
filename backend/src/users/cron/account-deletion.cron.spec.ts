import { Test, TestingModule } from '@nestjs/testing';
import { AccountDeletionCron } from './account-deletion.cron';
import { SupabaseService } from '../../supabase/supabase.service';
import { UsersService } from '../users.service';

describe('AccountDeletionCron', () => {
  let cron: AccountDeletionCron;
  let supabaseService: SupabaseService;
  let usersService: UsersService;
  const mockFrom = jest.fn();
  const mockSelect = jest.fn();
  const mockNot = jest.fn();
  const mockLte = jest.fn();
  const mockEq = jest.fn();
  const mockReturns = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockSupabaseClient = {
      from: mockFrom,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountDeletionCron,
        {
          provide: SupabaseService,
          useValue: { getClient: () => mockSupabaseClient },
        },
        {
          provide: UsersService,
          useValue: { permanentDeleteAccount: jest.fn() },
        },
      ],
    }).compile();

    cron = module.get<AccountDeletionCron>(AccountDeletionCron);
    supabaseService = module.get<SupabaseService>(SupabaseService);
    usersService = module.get<UsersService>(UsersService);

    // Set up the query chain mock
    mockSelect.mockReturnValue({ not: mockNot });
    mockNot.mockReturnValue({ lte: mockLte });
    mockLte.mockReturnValue({ returns: mockReturns });
    mockFrom.mockReturnValue({ select: mockSelect });
  });

  it('should be defined', () => {
    expect(cron).toBeDefined();
  });

  describe('handleAccountDeletions', () => {
    it('should log when no accounts are pending', async () => {
      mockReturns.mockResolvedValue({ data: [], error: null });
      const logSpy = jest.spyOn(
        (cron as Record<string, unknown>).logger as {
          log: (msg: string) => void;
        },
        'log',
      );

      await cron.handleAccountDeletions();

      expect(mockFrom).toHaveBeenCalledWith('users');
      expect(logSpy).toHaveBeenCalledWith(
        'No accounts pending deletion past the grace period.',
      );
    });

    it('should log error when fetch fails', async () => {
      const fetchError = { message: 'DB error' };
      mockReturns.mockResolvedValue({ data: null, error: fetchError });
      const errorSpy = jest.spyOn(
        (cron as Record<string, unknown>).logger as {
          error: (msg: string) => void;
        },
        'error',
      );

      await cron.handleAccountDeletions();

      expect(errorSpy).toHaveBeenCalled();
    });

    it('should delete accounts past their grace period', async () => {
      mockReturns.mockResolvedValue({
        data: [{ id: 'user-1' }, { id: 'user-2' }],
        error: null,
      });
      (usersService.permanentDeleteAccount as jest.Mock).mockResolvedValue(
        undefined,
      );
      const logSpy = jest.spyOn(
        (cron as Record<string, unknown>).logger as {
          log: (msg: string) => void;
        },
        'log',
      );

      await cron.handleAccountDeletions();

      expect(usersService.permanentDeleteAccount).toHaveBeenCalledWith(
        'user-1',
      );
      expect(usersService.permanentDeleteAccount).toHaveBeenCalledWith(
        'user-2',
      );
      expect(usersService.permanentDeleteAccount).toHaveBeenCalledTimes(2);
      expect(logSpy).toHaveBeenCalledWith('Successfully deleted user user-1');
      expect(logSpy).toHaveBeenCalledWith('Successfully deleted user user-2');
    });

    it('should handle deletion errors gracefully', async () => {
      mockReturns.mockResolvedValue({
        data: [{ id: 'user-1' }],
        error: null,
      });
      (usersService.permanentDeleteAccount as jest.Mock).mockRejectedValue(
        new Error('Deletion failed'),
      );
      const errorSpy = jest.spyOn(
        (cron as Record<string, unknown>).logger as {
          error: (msg: string) => void;
        },
        'error',
      );

      await cron.handleAccountDeletions();

      expect(errorSpy).toHaveBeenCalled();
    });

    it('should handle unexpected errors in the cron job', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('Unexpected error');
      });
      const errorSpy = jest.spyOn(
        (cron as Record<string, unknown>).logger as {
          error: (msg: string) => void;
        },
        'error',
      );

      await cron.handleAccountDeletions();

      expect(errorSpy).toHaveBeenCalledWith(
        'Unexpected error during account deletion cron',
        expect.anything(),
      );
    });
  });
});
