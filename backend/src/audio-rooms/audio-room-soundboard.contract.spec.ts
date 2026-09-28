import { validate } from 'class-validator';
import type { PinoLogger } from 'nestjs-pino';
import { AudioRoomsController } from './audio-rooms.controller';
import { AudioRoomsService } from './audio-rooms.service';
import { PlaySoundDto } from './dto/play-sound.dto';

describe('audio room soundboard contract', () => {
  const catalogue = {
    sounds: [
      {
        id: 'applause',
        name: 'Applause',
        url: 'https://legacy.example/sounds/applause.mp3',
        icon: '👏',
      },
    ],
  };

  function makeController() {
    const service = {
      getSoundboardSounds: vi.fn().mockReturnValue(catalogue),
      playSound: vi.fn().mockResolvedValue({
        success: true,
        soundUrl: 'https://legacy.example/sounds/applause.mp3',
      }),
    };
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    return {
      controller: new AudioRoomsController(
        service as unknown as AudioRoomsService,
        logger as unknown as PinoLogger,
      ),
      service,
    };
  }

  it('returns the bounded fixed catalogue through the existing list endpoint', () => {
    const { controller, service } = makeController();

    expect(controller.listSoundboardSounds()).toEqual(catalogue);
    expect(service.getSoundboardSounds).toHaveBeenCalledTimes(1);
  });

  it('never delegates a play mutation without an authenticated principal', async () => {
    const { controller, service } = makeController();

    await expect(
      controller.playSound(null, {
        room_id: 'room-1',
        sound_id: 'applause',
      }),
    ).resolves.toBeNull();
    expect(service.playSound).not.toHaveBeenCalled();
  });

  it('delegates the authenticated principal instead of accepting a caller-supplied user id', async () => {
    const { controller, service } = makeController();
    const dto = { room_id: 'room-1', sound_id: 'applause' };

    await controller.playSound({ id: 'host-1' }, dto);

    expect(service.playSound).toHaveBeenCalledWith('host-1', dto);
  });

  it('bounds room and sound identifiers at the DTO boundary', async () => {
    const valid = new PlaySoundDto();
    valid.room_id = 'room-1';
    valid.sound_id = 'applause';
    expect(await validate(valid)).toHaveLength(0);

    const invalid = new PlaySoundDto();
    invalid.room_id = 'r'.repeat(129);
    invalid.sound_id = 's'.repeat(65);
    const errors = await validate(invalid);

    expect(errors.map((error) => error.property).sort()).toEqual([
      'room_id',
      'sound_id',
    ]);
  });
});
