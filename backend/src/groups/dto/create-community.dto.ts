import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';

export class CreateCommunityDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
