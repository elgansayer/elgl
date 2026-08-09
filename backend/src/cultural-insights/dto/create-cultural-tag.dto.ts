import { IsString, IsNotEmpty } from 'class-validator';

export class CreateCulturalTagDto {
  @IsString()
  @IsNotEmpty()
  momentId!: string;

  @IsString()
  @IsNotEmpty()
  tagName!: string;
}
