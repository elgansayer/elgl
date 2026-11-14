import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SendMessageDto } from './send-message.dto';

const validateDto = (payload: Record<string, unknown>) =>
  validate(plainToInstance(SendMessageDto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

describe('SendMessageDto location payload', () => {
  it('accepts a static location message with bounded coordinates', async () => {
    const errors = await validateDto({
      room_id: 'room-1',
      message_type: 'location',
      location_payload: {
        latitude: 51.5074,
        longitude: -0.1278,
        label: 'Trafalgar Square',
      },
    });

    expect(errors).toEqual([]);
  });

  it('accepts a live location message', async () => {
    const errors = await validateDto({
      room_id: 'room-1',
      message_type: 'live_location',
      location_payload: {
        latitude: -33.8688,
        longitude: 151.2093,
        is_live: true,
      },
    });

    expect(errors).toEqual([]);
  });

  it('rejects a location message without a payload', async () => {
    const errors = await validateDto({
      room_id: 'room-1',
      message_type: 'location',
    });

    expect(JSON.stringify(errors)).toContain('location_payload');
  });

  it('rejects out-of-range coordinates', async () => {
    const errors = await validateDto({
      room_id: 'room-1',
      message_type: 'location',
      location_payload: { latitude: 91, longitude: 181 },
    });
    const serialised = JSON.stringify(errors);

    expect(serialised).toContain('max');
  });

  it('rejects an oversized label', async () => {
    const errors = await validateDto({
      room_id: 'room-1',
      message_type: 'location',
      location_payload: {
        latitude: 10,
        longitude: 10,
        label: 'x'.repeat(121),
      },
    });

    expect(JSON.stringify(errors)).toContain('maxLength');
  });
});
