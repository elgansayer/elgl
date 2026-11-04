import { validate } from 'class-validator';
import { CreateVoiceRoomNoteDto } from './voice-room-note.dto';

function createDto(
  content: unknown,
  vocabulary?: unknown,
): CreateVoiceRoomNoteDto {
  const dto = new CreateVoiceRoomNoteDto();
  if (content !== undefined) {
    (dto as Record<string, unknown>).content = content;
  }
  if (vocabulary !== undefined) {
    (dto as Record<string, unknown>).vocabulary = vocabulary;
  }
  return dto;
}

describe('CreateVoiceRoomNoteDto', () => {
  it('accepts valid note content without vocabulary', async () => {
    const dto = createDto('Discussion topic: favourite travel destinations');
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts valid note content with vocabulary', async () => {
    const dto = createDto(
      'Key phrases for restaurant ordering',
      'la cuenta, por favor, propina',
    );
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects empty content', async () => {
    const dto = createDto('');
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'content')).toBe(true);
  });

  it('rejects missing content', async () => {
    const dto = createDto(undefined);
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'content')).toBe(true);
  });

  it('rejects non-string content', async () => {
    const dto = createDto(12345);
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'content')).toBe(true);
  });

  it('rejects non-string vocabulary', async () => {
    const dto = createDto('Valid note topic', ['array', 'vocab']);
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'vocabulary')).toBe(true);
  });

  it('rejects content exceeding 2000 characters', async () => {
    const dto = createDto('a'.repeat(2001));
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'content')).toBe(true);
  });

  it('rejects vocabulary exceeding 500 characters', async () => {
    const dto = createDto('Valid note topic', 'v'.repeat(501));
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'vocabulary')).toBe(true);
  });
});
