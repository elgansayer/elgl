import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EventsCalendarQueryService } from './events-calendar-query.service';
import { EventCreationPolicyService } from './event-creation-policy.service';
import type { CreateEventDto } from './dto/create-event.dto';
import type { AuthenticatedRequest } from '../auth/authenticated-request.interface';

describe('EventsController', () => {
  let controller: EventsController;
  let eventsService: { createEvent: ReturnType<typeof vi.fn> };
  let policy: { assertCanCreate: ReturnType<typeof vi.fn> };

  const dto = {
    title: 'London meetup',
    description: 'Practise English and Japanese',
    date_time: '2099-01-01T18:00:00.000Z',
    venue_type: 'in_person',
    location: '61 Westminster Bridge Road',
    timezone: 'Europe/London',
    latitude: 51.4988,
    longitude: -0.1164,
    ticket_price_gbp: 5,
    ticket_price_usd: 6.5,
  } as CreateEventDto;

  const request = { user: { id: 'host-1' } } as AuthenticatedRequest;

  beforeEach(() => {
    eventsService = {
      createEvent: vi.fn().mockResolvedValue({ id: 'event-1' }),
    };
    policy = { assertCanCreate: vi.fn().mockResolvedValue(undefined) };
    controller = new EventsController(
      eventsService as unknown as EventsService,
      {} as EventsCalendarQueryService,
      policy as unknown as EventCreationPolicyService,
    );
  });

  it('validates creation policy before persisting the event', async () => {
    const result = await controller.create(request, dto);

    expect(policy.assertCanCreate).toHaveBeenCalledWith('host-1', dto);
    expect(eventsService.createEvent).toHaveBeenCalledWith('host-1', dto);
    expect(result).toEqual({ id: 'event-1' });
  });

  it('does not persist an event when the creation policy rejects it', async () => {
    policy.assertCanCreate.mockRejectedValueOnce(new Error('invalid venue'));

    await expect(controller.create(request, dto)).rejects.toThrow(
      'invalid venue',
    );
    expect(eventsService.createEvent).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated callers', async () => {
    await expect(
      controller.create({ user: null } as unknown as AuthenticatedRequest, dto),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(policy.assertCanCreate).not.toHaveBeenCalled();
  });
});
