import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UpdateProfileDto } from './update-profile.dto';

describe('UpdateProfileDto', () => {
  it('should be defined', () => {
    const dto = new UpdateProfileDto();
    expect(dto).toBeDefined();
  });

  async function learningGoalsErrors(value: unknown) {
    const dto = Object.assign(new UpdateProfileDto(), { learning_goals: value });
    return (await validate(dto)).filter((error) => error.property === 'learning_goals');
  }

  it('accepts free-text learning motivations up to 1000 characters', async () => {
    expect(await learningGoalsErrors('I want to speak naturally with my partner.')).toEqual([]);
    expect(await learningGoalsErrors('x'.repeat(1000))).toEqual([]);
  });

  it('rejects learning goals longer than 1000 characters', async () => {
    const errors = await learningGoalsErrors('x'.repeat(1001));
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('maxLength');
  });

  it('rejects non-string learning goals payloads', async () => {
    const errors = await learningGoalsErrors(['conversation', 'travel']);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isString');
  });
});
