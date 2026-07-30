import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCulturalGuideDto {
  @IsString()
  @IsNotEmpty()
  language!: string;

  @IsString()
  @IsNotEmpty()
  guide_text!: string;
}
