import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EventsQueryDto } from './events-query.dto';

describe('EventsQueryDto', () => {
  const validateDto = async (dto: Partial<EventsQueryDto>) => {
    const instance = plainToInstance(EventsQueryDto, dto);
    return validate(instance);
  };

  it('should validate a valid DTO', async () => {
    const dto: Partial<EventsQueryDto> = {
      language_pair: 'en-es',
      category: 'audio_room',
      status: 'upcoming',
      from_date: '2026-08-01',
      to_date: '2026-08-31',
      page: 1,
      limit: 20,
      proficiency: 'Intermediate',
    };

    const errors = await validateDto(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail if category is invalid', async () => {
    const dto: Partial<EventsQueryDto> = {
      category: 'invalid_category',
    };

    const errors = await validateDto(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('category');
  });

  it('should fail if status is invalid', async () => {
    const dto: Partial<EventsQueryDto> = {
      status: 'invalid_status',
    };

    const errors = await validateDto(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('status');
  });

  it('should fail if from_date is not ISO8601', async () => {
    const dto: Partial<EventsQueryDto> = {
      from_date: 'not-a-date',
    };

    const errors = await validateDto(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('from_date');
  });

  it('should fail if to_date is not ISO8601', async () => {
    const dto: Partial<EventsQueryDto> = {
      to_date: 'not-a-date',
    };

    const errors = await validateDto(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('to_date');
  });

  it('should fail if page is less than 1', async () => {
    const dto: Partial<EventsQueryDto> = {
      page: 0,
    };

    const errors = await validateDto(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('page');
  });

  it('should fail if limit is less than 1', async () => {
    const dto: Partial<EventsQueryDto> = {
      limit: 0,
    };

    const errors = await validateDto(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('limit');
  });

  it('should fail if proficiency is invalid', async () => {
    const dto: Partial<EventsQueryDto> = {
      proficiency: 'Expert',
    };

    const errors = await validateDto(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('proficiency');
  });

  it.each(['upcoming', 'past'])(
    'should validate status value "%s"',
    async (status) => {
      const dto: Partial<EventsQueryDto> = {
        status: status as 'upcoming' | 'past',
      };

      const errors = await validateDto(dto);
      expect(errors).toHaveLength(0);
    },
  );

  it('should fail if language_pair is not a string', async () => {
    const dto = { language_pair: 123 } as unknown as Partial<EventsQueryDto>;

    const errors = await validateDto(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('language_pair');
  });

  it('should default page and limit when not provided', () => {
    const instance = plainToInstance(EventsQueryDto, {});

    expect(instance.page).toBe(1);
    expect(instance.limit).toBe(20);
  });

  it('should validate a DTO with no fields provided', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });
});
