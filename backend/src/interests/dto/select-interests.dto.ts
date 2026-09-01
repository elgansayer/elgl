import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

const MAX_SELECTED_INTERESTS = 50;

export class SelectInterestsDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_SELECTED_INTERESTS)
  @ArrayUnique((value: unknown) =>
    typeof value === 'string' ? value.toLocaleLowerCase() : value,
  )
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  @Matches(/^\S(?:.*\S)?$/u, { each: true })
  interestTags?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_SELECTED_INTERESTS)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  interestIds?: string[];
}
