import { validate } from 'class-validator';
import { ForwardMessageDto } from './forward-message.dto';

const roomId = (index: number): string =>
  `20000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;

async function constraintsFor(roomIds: unknown): Promise<string[]> {
  const dto = Object.assign(new ForwardMessageDto(), { room_ids: roomIds });
  const errors = await validate(dto);
  return errors.flatMap((error) => Object.keys(error.constraints ?? {}));
}

describe('ForwardMessageDto', () => {
  it('accepts a bounded unique UUID target list', async () => {
    await expect(constraintsFor([roomId(1), roomId(2)])).resolves.toEqual([]);
  });

  it('requires at least one target room', async () => {
    await expect(constraintsFor([])).resolves.toContain('arrayMinSize');
  });

  it('caps a single forwarding action at ten rooms', async () => {
    const constraints = await constraintsFor(
      Array.from({ length: 11 }, (_, index) => roomId(index + 1)),
    );

    expect(constraints).toContain('arrayMaxSize');
  });

  it('rejects duplicate destination rooms before service fan-out', async () => {
    await expect(constraintsFor([roomId(1), roomId(1)])).resolves.toContain(
      'arrayUnique',
    );
  });

  it('rejects malformed room identifiers', async () => {
    await expect(constraintsFor(['not-a-room-id'])).resolves.toContain('isUuid');
  });

  it('rejects non-array request bodies', async () => {
    const constraints = await constraintsFor(roomId(1));
    expect(constraints).toContain('isArray');
  });
});
