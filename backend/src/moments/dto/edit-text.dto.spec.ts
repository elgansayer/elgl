import { validate } from 'class-validator';
import { EditTextDto } from './edit-text.dto';

describe('EditTextDto', () => {
  it('should accept a valid DTO with required fields', async () => {
    const dto = new EditTextDto();
    dto.textContent = 'This is a test moment text';

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should accept a DTO with all optional fields populated', async () => {
    const dto = new EditTextDto();
    dto.textContent = 'This is a test moment text';
    dto.explanation = 'A long explanation';
    dto.context = 'Additional context';
    dto.alternativeExpressions = ['paraphrase 1', 'paraphrase 2'];

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should fail when textContent is missing', async () => {
    const dto = new EditTextDto();

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const textContentError = errors.find(
      (error) => error.property === 'textContent',
    );
    expect(textContentError).toBeDefined();
  });

  it('should fail when textContent exceeds 4000 characters', async () => {
    const dto = new EditTextDto();
    dto.textContent = 'a'.repeat(4001);

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const textContentError = errors.find(
      (error) => error.property === 'textContent',
    );
    expect(textContentError).toBeDefined();
  });

  it('should fail when explanation exceeds 1000 characters', async () => {
    const dto = new EditTextDto();
    dto.textContent = 'valid text';
    dto.explanation = 'a'.repeat(1001);

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const explanationError = errors.find(
      (error) => error.property === 'explanation',
    );
    expect(explanationError).toBeDefined();
  });

  it('should fail when context exceeds 2000 characters', async () => {
    const dto = new EditTextDto();
    dto.textContent = 'valid text';
    dto.context = 'a'.repeat(2001);

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const contextError = errors.find((error) => error.property === 'context');
    expect(contextError).toBeDefined();
  });

  it('should fail when alternativeExpressions is not an array', async () => {
    const dto = new EditTextDto();
    dto.textContent = 'valid text';
    dto.alternativeExpressions = 'not-an-array' as unknown as string[];

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const arrayError = errors.find(
      (error) => error.property === 'alternativeExpressions',
    );
    expect(arrayError).toBeDefined();
  });

  it('should fail when alternativeExpressions contains a non-string element', async () => {
    const dto = new EditTextDto();
    dto.textContent = 'valid text';
    dto.alternativeExpressions = ['string', 123] as unknown as string[];

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const arrayError = errors.find(
      (error) => error.property === 'alternativeExpressions',
    );
    expect(arrayError).toBeDefined();
  });
});
