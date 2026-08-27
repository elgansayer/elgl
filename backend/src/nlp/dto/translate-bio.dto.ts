import { IsString, IsNotEmpty } from 'class-validator';

export class TranslateBioDto {
  @IsString()
  @IsNotEmpty()
  target_user_id!: string;

  @IsString()
  @IsNotEmpty()
  target_language!: string;
}
