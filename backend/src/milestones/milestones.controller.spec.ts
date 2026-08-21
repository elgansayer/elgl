import { Test, TestingModule } from '@nestjs/testing';
import { MilestonesController } from './milestones.controller';
import { MilestonesService } from './milestones.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

describe('MilestonesController', () => {
  let controller: MilestonesController;
  let service: MilestonesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MilestonesController],
      providers: [
        {
          provide: MilestonesService,
          useValue: {
            create: vi.fn().mockResolvedValue({ id: 'm-1' }),
            findAllForUser: vi.fn().mockResolvedValue([{ id: 'm-1' }]),
            findOneForUser: vi.fn().mockResolvedValue({ id: 'm-1' }),
            markCompleted: vi
              .fn()
              .mockResolvedValue({ id: 'm-1', completed: true }),
            remove: vi.fn().mockResolvedValue(undefined),
            getProgress: vi
              .fn()
              .mockResolvedValue({ total: 1, completed: 0, percentage: 0 }),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<MilestonesController>(MilestonesController);
    service = module.get<MilestonesService>(MilestonesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('creates a milestone for the authenticated user', async () => {
    await controller.create(
      { title: 'Learn 10 words' },
      { user: { sub: 'user-1' } },
    );
    expect(service.create).toHaveBeenCalledWith(
      { title: 'Learn 10 words' },
      'user-1',
    );
  });

  it('falls back to user.id when sub is absent', async () => {
    await controller.findAll({ user: { id: 'user-2' } });
    expect(service.findAllForUser).toHaveBeenCalledWith('user-2');
  });

  it('falls back to an empty string when no user is present', async () => {
    await controller.findAll({});
    expect(service.findAllForUser).toHaveBeenCalledWith('');
  });

  it('fetches progress for the authenticated user', async () => {
    const result = await controller.getProgress({ user: { sub: 'user-1' } });
    expect(service.getProgress).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ total: 1, completed: 0, percentage: 0 });
  });

  it('fetches a single milestone', async () => {
    await controller.findOne('m-1', { user: { sub: 'user-1' } });
    expect(service.findOneForUser).toHaveBeenCalledWith('user-1', 'm-1');
  });

  it('marks a milestone as completed', async () => {
    await controller.markCompleted('m-1', { user: { sub: 'user-1' } });
    expect(service.markCompleted).toHaveBeenCalledWith('m-1', 'user-1');
  });

  it('removes a milestone', async () => {
    await controller.remove('m-1', { user: { sub: 'user-1' } });
    expect(service.remove).toHaveBeenCalledWith('m-1', 'user-1');
  });

  it('throws an error when creating a milestone with invalid data', async () => {
    await expect(
      controller.create(
        { title: '' }, // Invalid title
        { user: { sub: 'user-1' } },
      ),
    ).rejects.toThrow('Validation failed');
  });

  it('returns an empty array when no milestones exist for the user', async () => {
    vi.spyOn(service, 'findAllForUser').mockResolvedValueOnce([]);
    const result = await controller.findAll({ user: { sub: 'user-1' } });
    expect(result).toEqual([]);
  });

  it('handles progress calculation when no milestones exist', async () => {
    vi.spyOn(service, 'getProgress').mockResolvedValueOnce({
      total: 0,
      completed: 0,
      percentage: 0,
    });
    const result = await controller.getProgress({ user: { sub: 'user-1' } });
    expect(result).toEqual({ total: 0, completed: 0, percentage: 0 });
  });

  it('throws an error when marking a non-existent milestone as completed', async () => {
    vi.spyOn(service, 'markCompleted').mockRejectedValueOnce(
      new Error('Milestone not found'),
    );
    await expect(
      controller.markCompleted('non-existent-id', { user: { sub: 'user-1' } }),
    ).rejects.toThrow('Milestone not found');
  });

  it('throws an error when removing a non-existent milestone', async () => {
    vi.spyOn(service, 'remove').mockRejectedValueOnce(
      new Error('Milestone not found'),
    );
    await expect(
      controller.remove('non-existent-id', { user: { sub: 'user-1' } }),
    ).rejects.toThrow('Milestone not found');
  });
});
