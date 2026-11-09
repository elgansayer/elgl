import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AddUserHobbyTagDto,
  CreateHobbyTagDto,
  HobbyVocabularyQueryDto,
  ListHobbyTagsQueryDto,
  UpdateHobbyProficiencyDto,
} from './hobby-tags.dto';

describe('hobby tag DTOs', () => {
  it('applies a bounded default catalogue limit', async () => {
    const dto = plainToInstance(ListHobbyTagsQueryDto, {});

    expect(await validate(dto)).toEqual([]);
    expect(dto.limit).toBe(100);
  });

  it('rejects oversized catalogue requests', async () => {
    const dto = plainToInstance(ListHobbyTagsQueryDto, { limit: '101' });

    expect(await validate(dto)).not.toEqual([]);
  });

  it('accepts a trimmed global tag', async () => {
    const dto = plainToInstance(CreateHobbyTagDto, {
      name: 'Urban gardening',
      category: 'Lifestyle',
      icon: '🌱',
    });

    expect(await validate(dto)).toEqual([]);
  });

  it('rejects blank or padded global tag fields', async () => {
    const blankName = plainToInstance(CreateHobbyTagDto, {
      name: '   ',
      category: 'Lifestyle',
    });
    const paddedCategory = plainToInstance(CreateHobbyTagDto, {
      name: 'Gardening',
      category: ' Lifestyle ',
    });

    expect(await validate(blankName)).not.toEqual([]);
    expect(await validate(paddedCategory)).not.toEqual([]);
  });

  it('requires a UUID and bounded proficiency', async () => {
    const add = plainToInstance(AddUserHobbyTagDto, {
      hobby_tag_id: 'not-a-uuid',
      proficiency_level: 4,
    });
    const update = plainToInstance(UpdateHobbyProficiencyDto, {
      proficiency_level: -1,
    });

    expect(await validate(add)).not.toEqual([]);
    expect(await validate(update)).not.toEqual([]);
  });

  it('accepts supported language-code shapes and rejects free text', async () => {
    const locale = plainToInstance(HobbyVocabularyQueryDto, {
      language: 'pt-BR',
    });
    const freeText = plainToInstance(HobbyVocabularyQueryDto, {
      language: 'Spanish',
    });

    expect(await validate(locale)).toEqual([]);
    expect(await validate(freeText)).not.toEqual([]);
  });
});
