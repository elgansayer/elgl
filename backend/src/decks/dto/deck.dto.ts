import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateDeckDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  colour?: string;

  @IsOptional()
  @IsString()
  icon?: string;
}

export class UpdateDeckDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  colour?: string;

  @IsOptional()
  @IsString()
  icon?: string;
}

export class AddFlashcardToDeckDto {
  @IsUUID()
  flashcard_id!: string;
}

export class RemoveFlashcardFromDeckDto {
  @IsUUID()
  flashcard_id!: string;
}
