import type { PinoLogger } from 'nestjs-pino';
import { UnauthorizedException } from '@nestjs/common';
import type { AudioRoomsService } from './audio-rooms.service';
import { AudioRoomsController } from './audio-rooms.controller';

describe('AudioRoomsController quick polls', () => {
  const createPoll = vi.fn();
  const submitVote = vi.fn();
  const getActivePoll = vi.fn();
  const getPollResults = vi.fn();
  let controller: AudioRoomsController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AudioRoomsController(
      {
        createPoll,
        submitVote,
        getActivePoll,
        getPollResults,
      } as unknown as AudioRoomsService,
      {} as PinoLogger,
    );
  });

  it('forwards authenticated create, active-poll, results, and vote requests', async () => {
    const dto = { question: 'Next topic?', options: ['Travel', 'Food'] };
    createPoll.mockResolvedValue({ poll_id: 'poll-1' });
    getActivePoll.mockResolvedValue(null);
    getPollResults.mockResolvedValue({ poll_id: 'poll-1' });

    await expect(
      controller.createPoll({ id: 'host-1' }, 'room-1', dto),
    ).resolves.toEqual({
      poll_id: 'poll-1',
    });
    await expect(
      controller.getActivePoll({ id: 'user-1' }, 'room-1'),
    ).resolves.toBeNull();
    await expect(
      controller.getPollResults({ id: 'user-1' }, 'room-1', 'poll-1'),
    ).resolves.toEqual({ poll_id: 'poll-1' });
    await controller.submitVote(
      { id: 'user-1' },
      { pollId: 'poll-1', optionIndex: 1 },
    );

    expect(createPoll).toHaveBeenCalledWith('host-1', 'room-1', dto);
    expect(getActivePoll).toHaveBeenCalledWith('user-1', 'room-1');
    expect(getPollResults).toHaveBeenCalledWith('user-1', 'room-1', 'poll-1');
    expect(submitVote).toHaveBeenCalledWith('user-1', {
      pollId: 'poll-1',
      optionIndex: 1,
    });
  });

  it('rejects unauthenticated poll requests', async () => {
    await expect(
      controller.createPoll(null, 'room-1', {
        question: 'Next topic?',
        options: ['Travel', 'Food'],
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      controller.submitVote(null, { pollId: 'poll-1', optionIndex: 0 }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      controller.getActivePoll(null, 'room-1'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      controller.getPollResults(null, 'room-1', 'poll-1'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(createPoll).not.toHaveBeenCalled();
    expect(submitVote).not.toHaveBeenCalled();
    expect(getActivePoll).not.toHaveBeenCalled();
    expect(getPollResults).not.toHaveBeenCalled();
  });
});
