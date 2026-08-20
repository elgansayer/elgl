import 'reflect-metadata';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateGroupChatDto } from './group-chat.dto';

const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;

function createDto(memberIds: string[]): CreateGroupChatDto {
  const dto = new CreateGroupChatDto();
  dto.name = 'Beginner French Grammar';
  dto.memberIds = memberIds;
  return dto;
}

describe('CreateGroupChatDto', () => {
  it('accepts one invited partner for a two-person group', async () => {
    await expect(validate(createDto([uuid(1)]))).resolves.toHaveLength(0);
  });

  it('accepts at most 18 invited partners because the creator is member 19', async () => {
    const errors = await validate(
      createDto(Array.from({ length: 18 }, (_, index) => uuid(index + 1))),
    );
    expect(errors).toHaveLength(0);
  });

  it('rejects a 20-person group at the API boundary', async () => {
    const errors = await validate(
      createDto(Array.from({ length: 19 }, (_, index) => uuid(index + 1))),
    );
    expect(errors.some((error) => error.property === 'memberIds')).toBe(true);
  });

  it('rejects duplicate invitees', async () => {
    const errors = await validate(createDto([uuid(1), uuid(1)]));
    expect(errors.some((error) => error.property === 'memberIds')).toBe(true);
  });

  it('rejects an empty group name and malformed member IDs', async () => {
    const dto = createDto(['not-a-uuid']);
    dto.name = '';
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['name', 'memberIds']),
    );
  });
});
