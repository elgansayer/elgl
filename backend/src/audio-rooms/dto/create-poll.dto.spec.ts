import { validate } from 'class-validator';
import { CreatePollDto } from './create-poll.dto';

function createDto(question: string, options: string[]): CreatePollDto {
  return Object.assign(new CreatePollDto(), { question, options });
}

describe('CreatePollDto', () => {
  it('accepts a poll with two to six unique options', async () => {
    await expect(
      validate(createDto('Next topic?', ['Travel', 'Food'])),
    ).resolves.toHaveLength(0);
    await expect(
      validate(createDto('Pick one', ['1', '2', '3', '4', '5', '6'])),
    ).resolves.toHaveLength(0);
  });

  it('requires at least two options', async () => {
    const errors = await validate(createDto('Next topic?', ['Travel']));
    expect(errors.some((error) => error.property === 'options')).toBe(true);
  });

  it('rejects more than six options', async () => {
    const errors = await validate(
      createDto('Next topic?', ['1', '2', '3', '4', '5', '6', '7']),
    );
    expect(errors.some((error) => error.property === 'options')).toBe(true);
  });

  it('rejects duplicate options after trimming and case folding', async () => {
    const errors = await validate(
      createDto('Next topic?', ['Travel', ' travel ']),
    );
    expect(errors.some((error) => error.property === 'options')).toBe(true);
  });

  it('bounds question and option lengths', async () => {
    const questionErrors = await validate(
      createDto('q'.repeat(301), ['One', 'Two']),
    );
    const optionErrors = await validate(
      createDto('Next topic?', ['a'.repeat(101), 'Two']),
    );

    expect(questionErrors.some((error) => error.property === 'question')).toBe(
      true,
    );
    expect(optionErrors.some((error) => error.property === 'options')).toBe(
      true,
    );
  });
});
