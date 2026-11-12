import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateEventDto } from './create-event.dto';

describe('CreateEventDto', () => {
  const validInput = () => ({
    title: ' Conversation practice ',
    description: ' Weekly learner meetup ',
    category: 'learning_seminar',
    date_time: '2099-01-01T18:00:00.000Z',
    venue_type: 'zoom',
    location: ' https://example.zoom.us/j/123 ',
    timezone: ' Europe/London ',
    language_pair: ' en-ja ',
    max_participants: 20,
    latitude: 51.5074,
    longitude: -0.1278,
    ticket_price_gbp: 5,
    ticket_price_usd: 6.5,
  });

  it('accepts and trims a bounded valid payload', async () => {
    const instance: CreateEventDto = plainToInstance(
      CreateEventDto,
      validInput(),
    );
    const errors = await validate(instance);

    expect(errors).toHaveLength(0);
    expect(instance.title).toBe('Conversation practice');
    expect(instance.location).toBe('https://example.zoom.us/j/123');
    expect(instance.timezone).toBe('Europe/London');
  });

  it('rejects whitespace-only titles', async () => {
    const instance: CreateEventDto = plainToInstance(CreateEventDto, {
      ...validInput(),
      title: '   ',
    });

    const errors = await validate(instance);
    expect(errors.some((error) => error.property === 'title')).toBe(true);
  });

  it('rejects oversized descriptions', async () => {
    const instance: CreateEventDto = plainToInstance(CreateEventDto, {
      ...validInput(),
      description: 'x'.repeat(2001),
    });

    const errors = await validate(instance);
    expect(errors.some((error) => error.property === 'description')).toBe(true);
  });

  it('rejects unsupported venue modes', async () => {
    const instance: CreateEventDto = plainToInstance(CreateEventDto, {
      ...validInput(),
      venue_type: 'javascript',
    });

    const errors = await validate(instance);
    expect(errors.some((error) => error.property === 'venue_type')).toBe(true);
  });

  it('rejects participant limits outside the public contract', async () => {
    const tooMany: CreateEventDto = plainToInstance(CreateEventDto, {
      ...validInput(),
      max_participants: 101,
    });
    const errors = await validate(tooMany);

    expect(errors.some((error) => error.property === 'max_participants')).toBe(
      true,
    );
  });

  it('rejects map coordinates outside valid ranges', async () => {
    for (const invalid of [
      { latitude: 91 },
      { latitude: -91 },
      { longitude: 181 },
      { longitude: -181 },
    ]) {
      const instance: CreateEventDto = plainToInstance(CreateEventDto, {
        ...validInput(),
        ...invalid,
      });
      const errors = await validate(instance);
      expect(
        errors.some(
          (error) =>
            error.property === 'latitude' || error.property === 'longitude',
        ),
      ).toBe(true);
    }
  });

  it('rejects negative or excessive ticket prices', async () => {
    for (const invalid of [
      { ticket_price_gbp: -1 },
      { ticket_price_usd: -0.01 },
      { ticket_price_gbp: 100001 },
    ]) {
      const instance: CreateEventDto = plainToInstance(CreateEventDto, {
        ...validInput(),
        ...invalid,
      });
      const errors = await validate(instance);
      expect(
        errors.some(
          (error) =>
            error.property === 'ticket_price_gbp' ||
            error.property === 'ticket_price_usd',
        ),
      ).toBe(true);
    }
  });
});
