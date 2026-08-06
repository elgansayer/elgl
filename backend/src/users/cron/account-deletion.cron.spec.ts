import { Test, TestingModule } from '@nestjs/testing';
import { AccountDeletionCron } from './account-deletion.cron';
import { SupabaseService } from '../../supabase/supabase.service';
import { UsersService } from '../users.service';

describe('AccountDeletionCron', () => {
  let cron: AccountDeletionCron;
  let mockSupabaseClient: Record<string, jest.Mock>;
  let mockUsersService: { permanentDeleteAccount: jest.Mock };

  beforeEach(async () => {
    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      returns: jest.fn(),
    };

    mockUsersService = {
      permanentDeleteAccount: jest.fn().mockResolvedValue(undefined),
    };

    const mockSupabaseService = {
      getClient: jest.fn().mockReturnValue(mockSupabaseClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountDeletionCron,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    cron = module.get<AccountDeletionCron>(AccountDeletionCron);
  });

  it('should be defined', () => {
    expect(cron).toBeDefined();
  });

  it('should log and return early when fetch returns error', async () => {
    mockSupabaseClient.returns.mockResolvedValue({
      data: null,
      error: { message: 'DB error' },
    });

    const loggerSpy = jest.spyOn((cron as any).logger, 'error');

    await cron.handleAccountDeletions();

    expect(loggerSpy).toHaveBeenCalledWith(
      'Failed to fetch users for deletion',
      { message: 'DB error' },
    );
    expect(mockUsersService.permanentDeleteAccount).not.toHaveBeenCalled();
  });

  it('should log and return early when no users pending deletion', async () => {
    mockSupabaseClient.returns.mockResolvedValue({
      data: [],
      error: null,
    });

    const loggerSpy = jest.spyOn((cron as any).logger, 'log');

    await cron.handleAccountDeletions();

    expect(loggerSpy).toHaveBeenCalledWith(
      'No accounts pending deletion past the grace period.',
    );
    expect(mockUsersService.permanentDeleteAccount).not.toHaveBeenCalled();
  });

  it('should call permanentDeleteAccount for each user past grace period', async () => {
    mockSupabaseClient.returns.mockResolvedValue({
      data: [{ id: 'user-1' }, { id: 'user-2' }],
      error: null,
    });

    await cron.handleAccountDeletions();

    expect(mockUsersService.permanentDeleteAccount).toHaveBeenCalledTimes(2);
    expect(mockUsersService.permanentDeleteAccount).toHaveBeenCalledWith(
      'user-1',
    );
    expect(mockUsersService.permanentDeleteAccount).toHaveBeenCalledWith(
      'user-2',
    );
  });

  it('should handle errors from individual deletions gracefully', async () => {
    mockSupabaseClient.returns.mockResolvedValue({
      data: [{ id: 'user-1' }, { id: 'user-2' }],
      error: null,
    });
    mockUsersService.permanentDeleteAccount
      .mockRejectedValueOnce(new Error('Delete failed'))
      .mockResolvedValueOnce(undefined);

    const loggerSpy = jest.spyOn((cron as any).logger, 'error');

    await cron.handleAccountDeletions();

    expect(loggerSpy).toHaveBeenCalledWith(
      'Failed to delete user user-1: Delete failed',
    );
    expect(mockUsersService.permanentDeleteAccount).toHaveBeenCalledTimes(2);
  });

  it('should handle unexpected errors gracefully', async () => {
    mockSupabaseClient.returns.mockRejectedValue(new Error('Unexpected'));

    const loggerSpy = jest.spyOn((cron as any).logger, 'error');

    await cron.handleAccountDeletions();

    expect(loggerSpy).toHaveBeenCalledWith(
      'Unexpected error during account deletion cron',
      expect.any(Error),
    );
    expect(mockUsersService.permanentDeleteAccount).not.toHaveBeenCalled();
  });
});