import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AddMemberDto } from './add-member.dto';
import {
  CreateGroupDto,
  GROUP_NAME_MAX_LENGTH,
  RenameGroupDto,
} from './group.dto';

const MEMBER_A = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const MEMBER_B = '5a8fbd9b-2b5c-4c0e-8d0a-9d3b6b1e5a11';

function memberId(index: number): string {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
}

describe('CreateGroupDto', () => {
  it('trims the name and accepts 50 unique member ids', async () => {
    const memberIds = Array.from({ length: 50 }, (_, index) =>
      memberId(index + 1),
    );
    const dto = plainToInstance(CreateGroupDto, {
      name: '  Spanish Club  ',
      memberIds,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.name).toBe('Spanish Club');
  });

  it.each([
    {},
    { name: '   ', memberIds: [MEMBER_A] },
    {
      name: 'x'.repeat(GROUP_NAME_MAX_LENGTH + 1),
      memberIds: [MEMBER_A],
    },
    { name: 'Spanish Club', memberIds: [] },
    { name: 'Spanish Club', memberIds: MEMBER_A },
    { name: 'Spanish Club', memberIds: [MEMBER_A, MEMBER_A] },
    { name: 'Spanish Club', memberIds: ['not-a-uuid'] },
    {
      name: 'Spanish Club',
      memberIds: Array.from({ length: 51 }, (_, index) => memberId(index + 1)),
    },
    {
      name: 'Spanish Club',
      memberIds: [MEMBER_A],
      inviteCode: 42,
    },
  ])('rejects invalid body %#', async (input) => {
    expect(
      await validate(plainToInstance(CreateGroupDto, input)),
    ).not.toHaveLength(0);
  });
});

describe('RenameGroupDto', () => {
  it('trims and accepts a name up to the limit', async () => {
    const dto = plainToInstance(RenameGroupDto, { name: '  Spanish Club  ' });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.name).toBe('Spanish Club');
    await expect(
      validate(
        plainToInstance(RenameGroupDto, {
          name: 'x'.repeat(GROUP_NAME_MAX_LENGTH),
        }),
      ),
    ).resolves.toHaveLength(0);
  });

  it.each([
    {},
    { name: '' },
    { name: '   ' },
    { name: 42 },
    { name: 'x'.repeat(GROUP_NAME_MAX_LENGTH + 1) },
  ])('rejects invalid body %#', async (input) => {
    expect(
      await validate(plainToInstance(RenameGroupDto, input)),
    ).not.toHaveLength(0);
  });
});

describe('AddMemberDto', () => {
  it('accepts between 1 and 49 user ids', async () => {
    await expect(
      validate(
        plainToInstance(AddMemberDto, { memberIds: [MEMBER_A, MEMBER_B] }),
      ),
    ).resolves.toHaveLength(0);
  });

  it.each([
    {},
    { memberIds: [] },
    { memberIds: MEMBER_A },
    { memberIds: ['not-a-uuid'] },
    { memberIds: [MEMBER_A, 42] },
    { memberIds: Array.from({ length: 50 }, () => MEMBER_A) },
  ])('rejects invalid body %#', async (input) => {
    expect(
      await validate(plainToInstance(AddMemberDto, input)),
    ).not.toHaveLength(0);
  });
});
