import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ProfileVisitsController } from './profile-visits.controller';
import { ProfileVisitsService } from './profile-visits.service';

describe('ProfileVisitsController', () => {
  let controller: ProfileVisitsController;
  let profileVisitsService: { getVisitors: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    profileVisitsService = {
      getVisitors: vi.fn().mockResolvedValue([]),
    };
    controller = new ProfileVisitsController(
      profileVisitsService as unknown as ProfileVisitsService,
    );
  });

  it('requires an authenticated user', async () => {
    await expect(
      controller.getVisitors('profile-1', null, 50, 0),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('delegates owner authorization and pagination to ProfileVisitsService', async () => {
    await controller.getVisitors(
      'profile-1',
      { id: 'profile-1' } as any,
      25,
      10,
    );

    expect(profileVisitsService.getVisitors).toHaveBeenCalledWith(
      'profile-1',
      'profile-1',
      25,
      10,
    );
  });

  it('rejects invalid pagination before querying visitor history', async () => {
    await expect(
      controller.getVisitors(
        'profile-1',
        { id: 'profile-1' } as any,
        0,
        -1,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(profileVisitsService.getVisitors).not.toHaveBeenCalled();
  });
});
