import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';

export class InitiateCallDto {
  @IsString()
  @IsNotEmpty()
  callee_id!: string;

  @IsOptional()
  @IsBoolean()
  is_video?: boolean;
}
