import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class TranslateUiDto {
  @IsString()
  @IsNotEmpty()
  target_language!: string;

  @IsObject()
  @IsNotEmpty()
  dictionary!: Record<string, string>;
}
