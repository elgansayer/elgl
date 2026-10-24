import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { Mock } from 'vitest';
import { EventCreationPolicyService } from './event-creation-policy.service';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateEventDto } from './dto/create-event.dto';

describe('EventCreationPolicyService', () => {
  let service: EventCreationPolicyService;
  let getClient: Mock;

  const futureDate = () =>
    new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const dto = (overrides: Partial<CreateEventDto> = {}): CreateEventDto => ({
    title: 'Language exchange',
    description: 'Weekly language exchange',
    date_time: futureDate(),
    venue_type: 'zoom',
    location: 'https://example.zoom.us/j/123456789',
    timezone: 'Europe/London',
    ...overrides,
  });

  beforeEach(() => {
    getClient = vi.fn();
    service = new EventCreationPolicyService({
      getClient,
    } as unknown as SupabaseService);
  });

  it('accepts a future event with a safe web meeting URL', async () => {
    await expect(
      service.assertCanCreate('host-1', dto()),
    ).resolves.toBeUndefined();
    expect(getClient).not.toHaveBeenCalled();
  });

  it('rejects past event times', async () => {
    await expect(
      service.assertCanCreate(
        'host-1',
        dto({ date_time: new Date(Date.now() - 1000).toISOString() }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid IANA timezones', async () => {
    await expect(
      service.assertCanCreate('host-1', dto({ timezone: 'Not/A_Timezone' })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unsafe meeting URL schemes', async () => {
    await expect(
      service.assertCanCreate(
        'host-1',
        dto({ venue_type: 'zoom', location: 'javascript:alert(1)' }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects malformed Audio Room identifiers without querying storage', async () => {
    await expect(
      service.assertCanCreate(
        'host-1',
        dto({ venue_type: 'audio_room', location: 'not-a-uuid' }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(getClient).not.toHaveBeenCalled();
  });

  it('allows the host to schedule an existing active Audio Room', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: '123e4567-e89b-42d3-a456-426614174000',
        host_id: 'host-1',
        is_active: true,
      },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    getClient.mockReturnValue({ from });

    await expect(
      service.assertCanCreate(
        'host-1',
        dto({
          venue_type: 'audio_room',
          location: '123e4567-e89b-42d3-a456-426614174000',
        }),
      ),
    ).resolves.toBeUndefined();
    expect(from).toHaveBeenCalledWith('audio_rooms');
  });

  it('rejects Audio Rooms owned by another user', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: '123e4567-e89b-42d3-a456-426614174000',
        host_id: 'other-host',
        is_active: true,
      },
      error: null,
    });
    getClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle }),
        }),
      }),
    });

    await expect(
      service.assertCanCreate(
        'host-1',
        dto({
          venue_type: 'audio_room',
          location: '123e4567-e89b-42d3-a456-426614174000',
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('fails closed when Audio Room validation storage fails', async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'db down' } });
    getClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle }),
        }),
      }),
    });

    await expect(
      service.assertCanCreate(
        'host-1',
        dto({
          venue_type: 'audio_room',
          location: '123e4567-e89b-42d3-a456-426614174000',
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
