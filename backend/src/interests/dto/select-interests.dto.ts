import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const MAX_SELECTED_INTERESTS = 50;

@ValidatorConstraint({ name: 'exactlyOneInterestSelection', async: false })
class ExactlyOneInterestSelectionConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const body = args.object as SelectInterestsDto;
    return (
      Number(Array.isArray(body.interestTags)) +
        Number(Array.isArray(body.interestIds)) ===
      1
    );
  }

  defaultMessage(): string {
    return 'exactly one of interestTags or interestIds must be an array';
  }
}

export class SelectInterestsDto {
  @Validate(ExactlyOneInterestSelectionConstraint)
  private readonly selectionContract?: never;

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
