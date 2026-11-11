import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ClassReplaysController } from './class-replays.controller';
import { ClassReplaysService } from './class-replays.service';
import { replayFixture } from './class-replays.test-fixture';

function createController() {
  const service = {
    createReplay: vi.fn().mockResolvedValue(replayFixture()),
    listReplays: vi.fn().mockResolvedValue([replayFixture()]),
    getReplay: vi.fn().mockResolvedValue(replayFixture()),
    getPlayback: vi.fn().mockResolvedValue({
      replay_id: replayFixture().id,
      status: 'ready',
      hls_url: 'https://media.example.test/replay.m3u8',
      dash_url: 'https://media.example.test/replay.mpd',
      download_url: 'https://media.example.test/replay.mp4',
      thumbnail_url: null,
      duration_seconds: 60,
      expires_at: null,
    }),
    retry: vi.fn().mockResolvedValue(undefined),
    deleteReplay: vi.fn().mockResolvedValue(undefined),
  };
  return {
    controller: new ClassReplaysController(
      service as unknown as ClassReplaysService,
    ),
    service,
  };
}

describe('ClassReplaysController', () => {
  it('requires an authenticated user for every operation', async () => {
    const { controller } = createController();

    await expect(controller.list(null, {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      controller.get(null, replayFixture().id),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('delegates replay operations with the authenticated user identity', async () => {
    const { controller, service } = createController();
    const user = { id: 'host-1' };

    await controller.create(user, {
      roomId: 'room-1',
      title: 'Travel phrases',
      sourceUrl: 'https://media.example.test/class.mp4',
    });
    await controller.list(user, { roomId: 'room-1' });
    await controller.playback(user, replayFixture().id);
    await controller.retry(user, replayFixture().id);
    await controller.remove(user, replayFixture().id);

    expect(service.createReplay).toHaveBeenCalledWith('host-1', {
      roomId: 'room-1',
      title: 'Travel phrases',
      sourceUrl: 'https://media.example.test/class.mp4',
    });
    expect(service.listReplays).toHaveBeenCalledWith('host-1', {
      roomId: 'room-1',
    });
    expect(service.getPlayback).toHaveBeenCalledWith(
      'host-1',
      replayFixture().id,
    );
    expect(service.retry).toHaveBeenCalledWith('host-1', replayFixture().id);
    expect(service.deleteReplay).toHaveBeenCalledWith(
      'host-1',
      replayFixture().id,
    );
  });
});
