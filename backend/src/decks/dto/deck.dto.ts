import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDeckDto {
  @ApiProperty({
    description: 'Name of the flashcard deck',
    example: 'French Basics',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name!: string;

  @ApiPropertyOptional({
    description: 'Optional description of the deck',
    example: 'Essential French vocabulary for beginners',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional({
    description: 'Hex colour code for the deck visual indicator',
    example: '#6366f1',
  })
  @IsOptional()
  @IsString()
  @MaxLength(9)
  colour?: string;

  @ApiPropertyOptional({
    description: 'Icon identifier for the deck',
    example: 'book-outline',
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  icon?: string;
}

export class UpdateDeckDto {
  @ApiPropertyOptional({
    description: 'Updated deck name',
    example: 'French Essentials',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name?: string;

  @ApiPropertyOptional({
    description: 'Updated deck description',
    example: 'Core French vocabulary and phrases',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional({
    description: 'Updated hex colour code',
    example: '#a855f7',
  })
  @IsOptional()
  @IsString()
  @MaxLength(9)
  colour?: string;

  @ApiPropertyOptional({
    description: 'Updated icon identifier',
    example: 'library-outline',
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  icon?: string;
}

export class AddFlashcardToDeckDto {
  @ApiProperty({
    description: 'UUID of the flashcard to add to the deck',
    example: 'c9b1a2d3-e4f5-6789-abcd-ef0123456789',
  })
  @IsUUID()
  flashcard_id!: string;
}

export class RemoveFlashcardFromDeckDto {
  @ApiProperty({
    description: 'UUID of the flashcard to remove from the deck',
    example: 'c9b1a2d3-e4f5-6789-abcd-ef0123456789',
  })
  @IsUUID()
  flashcard_id!: string;
}
